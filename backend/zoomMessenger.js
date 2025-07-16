// zoomMessenger.js
const axios = require('axios');

class ZoomMessenger {
  constructor() {
    this.baseURL = 'https://api.zoom.us/v2';
    this.accessToken = process.env.ZOOM_ACCESS_TOKEN;
    this.botJID = process.env.ZOOM_BOT_JID;
  }

  // Get access token using JWT
  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    // If using JWT authentication
    const jwt = require('jsonwebtoken');
    const apiKey = process.env.ZOOM_API_KEY;
    const apiSecret = process.env.ZOOM_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Zoom API credentials not configured');
    }

    const payload = {
      iss: apiKey,
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };

    this.accessToken = jwt.sign(payload, apiSecret);
    return this.accessToken;
  }

  // Send direct message to a Zoom user
  async sendDirectMessage(toJID, message) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseURL}/im/chat/messages`,
        {
          to_channel: toJID,
          message: message,
          message_type: 1 // 1 for text message
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Zoom message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending Zoom message:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send message to a channel
  async sendChannelMessage(channelId, message) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseURL}/im/chat/messages`,
        {
          to_channel: channelId,
          message: message,
          message_type: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Zoom channel message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending Zoom channel message:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get user list
  async getUsers() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseURL}/users`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data.users;
    } catch (error) {
      console.error('Error getting Zoom users:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get channels
  async getChannels() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseURL}/im/chat/channels`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data.channels;
    } catch (error) {
      console.error('Error getting Zoom channels:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = ZoomMessenger; 