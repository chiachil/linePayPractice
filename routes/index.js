const express = require('express');
const router = express.Router();
const axios = require('axios');
const { HmacSHA256 } = require('crypto-js');
const Base64 = require('crypto-js/enc-base64');
require('dotenv').config();

// 環境變數
const {
  LINEPAY_CHANNEL_ID,
  LINEPAY_RETURN_HOST,
  LINEPAY_SITE,
  LINEPAY_VERSION,
  LINEPAY_CHANNEL_SECRET_KEY,
  LINEPAY_RETURN_CONFIRM_URL,
  LINEPAY_RETURN_CANCEL_URL,
} = process.env;

const sampleData = require('../sample/sampleData');
const orders = {};

// 前端頁面
router
  .get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
  })
  .get('/checkout/:id', (req, res) => {
    const { id } = req.params;
    const order = sampleData[id];
    order.orderId = parseInt(new Date().getTime() / 1000);
    orders[order.orderId] = order;
    res.render('checkout', { order });
  })

// linePay 串接 api
router
  .post('/createOrder/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const order = orders[orderId];
    try{
      const linePayBody = {
        ...order,
        redirectUrls:{
          confirmUrl:`${LINEPAY_RETURN_CONFIRM_URL}`,
          cancelUrl: `${LINEPAY_RETURN_CANCEL_URL}`
        }
      }
      const uri = '/payments/request';
      const headers = createSignature(uri, linePayBody);
      // 送給 line
      const url = createUrl(uri);
      const linePayRes = await axios.post(url, linePayBody, { headers })
      if(linePayRes?.data?.returnCode === '0000'){
        res.redirect(linePayRes?.data?.info.paymentUrl.web);
      }
    } catch (error){
      console.log(error);
      res.end();
    }})
  .get('/linePay/confirm', async (req, res) => {
    const { transactionId, orderId } = req.query;
    console.log(transactionId, orderId);
    try {
      const order = orders[orderId];
      const linePayBody = {
        amount: order.amount,
        currency: 'TWD',
      }
      const uri = `/v3/payments/${transactionId}/confirm`
      const headers = createSignature(uri, linePayBody);
      const url = createUrl(uri)
      const linePayRes = await axios.post(url, linePayBody, { headers })
      console.log(linePayRes)
    } catch (error) {
      console.log(error);
      res.end();
    }

  })

function createUrl(uri) {
  return `${LINEPAY_SITE}/${LINEPAY_VERSION}${uri}`;
}

function createSignature(uri, linePayBody) {

  const nonce = parseInt(new Date().getTime() / 1000);
  const string = `${LINEPAY_CHANNEL_SECRET_KEY}/${LINEPAY_VERSION}${uri}${JSON.stringify(
    linePayBody
  )}${nonce}`;
  const signature = Base64.stringify(
    HmacSHA256(string, LINEPAY_CHANNEL_SECRET_KEY)
  );
  const headers = {
    'Content-Type': 'application/json',
    'X-LINE-ChannelId': LINEPAY_CHANNEL_ID,
    'X-LINE-Authorization-Nonce': nonce,
    'X-LINE-Authorization': signature
  };
  return headers;
}

module.exports = router;

