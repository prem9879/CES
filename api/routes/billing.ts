import { Router } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'
import { requireUserAuth } from '../middleware/jwtAuth'
import {
  findUserById,
  findUserByStripeCustomerId,
  findUserByStripeSubscriptionId,
  publicUser,
  updateUserSubscription,
} from '../lib/user-store'

const billingRoutes = Router()

const planSchema = z.object({
  plan: z.enum(['pro', 'enterprise'])
})

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

function statusToPlan(status: string, priceId?: string): 'free' | 'pro' | 'enterprise' {
  const enterprisePriceId = process.env.STRIPE_PRICE_ENTERPRISE || process.env.STRIPE_PRICE_ULTRA
  if (!priceId) return status === 'active' ? 'pro' : 'free'
  if (priceId === enterprisePriceId) return 'enterprise'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_FREE) return 'free'
  return status === 'active' ? 'pro' : 'free'
}

billingRoutes.get('/subscription', requireUserAuth, (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = findUserById(req.authUser.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  return res.json({
    user: publicUser(user),
    subscription: user.subscription,
  })
})

billingRoutes.post('/checkout', requireUserAuth, async (req, res) => {
  const parsed = planSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }

  if (!stripe) {
    return res.status(400).json({
      error: 'Stripe not configured',
      hint: 'Set STRIPE_SECRET_KEY and plan-specific price IDs.'
    })
  }

  const priceMap: Record<'pro' | 'enterprise', string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || process.env.STRIPE_PRICE_ULTRA
  }

  const selectedPrice = priceMap[parsed.data.plan]
  if (!selectedPrice) {
    return res.status(400).json({ error: `Stripe price ID missing for plan '${parsed.data.plan}'` })
  }

  if (!req.authUser) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = findUserById(req.authUser.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const successUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing?status=success'
  const cancelUrl = process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/billing?status=cancelled'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: selectedPrice, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      plan: parsed.data.plan,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true
  })

  return res.json({ checkoutUrl: session.url, sessionId: session.id })
})

billingRoutes.post('/portal', requireUserAuth, async (req, res) => {
  if (!stripe) {
    return res.status(400).json({
      error: 'Stripe not configured',
      hint: 'Set STRIPE_SECRET_KEY and STRIPE_PORTAL_RETURN_URL.'
    })
  }

  if (!req.authUser) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = findUserById(req.authUser.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (!user.subscription.stripeCustomerId) {
    return res.status(400).json({
      error: 'No Stripe customer profile found for this account yet.',
      hint: 'Complete checkout first, then open the billing portal.'
    })
  }

  const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/billing/'

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.subscription.stripeCustomerId,
    return_url: returnUrl,
  })

  return res.json({ portalUrl: portal.url })
})

billingRoutes.post('/webhook', async (req, res) => {
  if (!stripe) {
    return res.status(400).json({ error: 'Stripe not configured' })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = req.headers['stripe-signature']
  if (!webhookSecret || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Webhook secret/signature missing.' })
  }

  let event: any
  try {
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body || {}))
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    return res.status(400).json({ error: message })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const userId = session.metadata?.userId || session.client_reference_id
      if (userId) {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
        const firstLine = lineItems.data[0]
        const priceId = firstLine?.price?.id
        updateUserSubscription(userId, {
          status: 'active',
          plan: statusToPlan('active', priceId),
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
          currentPeriodEnd: undefined,
        })
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as any
      const subscriptionWithPeriod = subscription as { current_period_end?: number }
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : undefined
      const item = subscription.items.data[0]
      const priceId = item?.price?.id
      const user =
        findUserByStripeSubscriptionId(subscription.id) ||
        (customerId ? findUserByStripeCustomerId(customerId) : undefined)

      if (user) {
        updateUserSubscription(user.id, {
          status: subscription.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid',
          plan: statusToPlan(subscription.status, priceId),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: subscriptionWithPeriod.current_period_end
            ? subscriptionWithPeriod.current_period_end * 1000
            : undefined,
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any
      const subscriptionWithPeriod = subscription as { current_period_end?: number }
      const user = findUserByStripeSubscriptionId(subscription.id)
      if (user) {
        updateUserSubscription(user.id, {
          status: 'canceled',
          plan: 'free',
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : undefined,
          currentPeriodEnd: subscriptionWithPeriod.current_period_end
            ? subscriptionWithPeriod.current_period_end * 1000
            : undefined,
        })
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : undefined
      const user = customerId ? findUserByStripeCustomerId(customerId) : undefined

      if (user) {
        updateUserSubscription(user.id, {
          status: 'past_due',
          plan: user.subscription.plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : user.subscription.stripeSubscriptionId,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
        })
      }
    }

    return res.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    return res.status(500).json({ error: message })
  }
})

export { billingRoutes }
