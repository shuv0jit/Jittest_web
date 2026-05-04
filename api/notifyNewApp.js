import admin from 'firebase-admin';

// Initialize Firebase Admin securely using Environment Variables in Vercel
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace escaped literal newlines to actual newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { appName } = req.body;
    const db = admin.firestore();

    // Get all users who have the role 'tester'
    const usersSnap = await db.collection('users').where('role', '==', 'tester').get();

    const tokens = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'No notification tokens found among testers.' });
    }

    const message = {
      notification: {
        title: 'New App Ready for Testing! 🚀',
        body: `An app named "${appName}" has just been added. Start testing now!`,
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: error.message });
  }
}