const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// API key auth middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if (process.env.API_KEY && (!key || key !== process.env.API_KEY)) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }
  next();
});

// Slack webhook URL
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
if (!SLACK_WEBHOOK_URL) {
  console.error('SLACK_WEBHOOK_URL environment variable is required');
}

// Endpoint to handle Shopify webhook payload
app.post('/shopify/webhook', (req, res) => {
  try {
    const { order } = req.body;
    if (!order) {
      return res.status(400).json({ success: false, error: 'Missing order data in webhook payload' });
    }

    // Extract relevant order information
    const { id, customer, line_items, total_price } = order;
    const customerName = customer ? customer.name : 'Guest';

    // Format Slack notification message
    const slackMessage = {
      text: `New order #${id} from ${customerName}`,
      attachments: [
        {
          title: 'Order Details',
          fields: [
            {
              title: 'Customer',
              value: customerName,
              short: true,
            },
            {
              title: 'Total',
              value: `$${total_price}`,
              short: true,
            },
          ],
          footer: 'Shopify Order Notification',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    // Send Slack notification
    const axios = require('axios');
    axios.post(SLACK_WEBHOOK_URL, slackMessage)
      .then(() => {
        res.json({ success: true, data: { message: 'Slack notification sent successfully' } });
      })
      .catch((error) => {
        console.error('Error sending Slack notification:', error);
        res.status(500).json({ success: false, error: 'Failed to send Slack notification' });
      });
  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ success: true, data: { message: 'API is healthy' } });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});