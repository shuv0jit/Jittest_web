import admin from 'firebase-admin';

// Initialize Firebase Admin securely using Environment Variables in Vercel
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { testerId, amount } = req.body;
    const db = admin.firestore();

    // Get the specific user to find their FCM Token
    const userDoc = await db.collection('users').doc(testerId).get();
    const fcmToken = userDoc.exists ? userDoc.data().fcmToken : null;

    if (!fcmToken) {
      return res.status(200).json({ message: 'User does not have push notifications enabled.' });
    }

    const response = await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'Withdrawal Approved! 🎉',
        body: `Congratulations! Your withdrawal request for ${amount} TK has been accepted and processed.`,
      }
    });
    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error sending targeted notification:', error);
    return res.status(500).json({ error: error.message });
  }
}