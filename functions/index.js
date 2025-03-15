const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
admin.initializeApp();

// Create a Nodemailer transporter
// Note: In production, you would use a proper email service with authentication
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password
  }
});

/**
 * Cloud Function that triggers when a new notification document is created
 * This handles immediate notifications
 */
exports.sendNotificationEmail = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    try {
      // Skip if not an email notification
      if (notification.notificationType !== 'email') {
        console.log('Not an email notification, skipping');
        return null;
      }
      
      // Get user details
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .get();
      
      const userData = userDoc.exists ? userDoc.data() : {};
      const recipientName = userData.displayName || 'User';
      
      // Create URLs list for email
      const urlList = notification.changedURLs.map(url => 
        `<li><a href="${url.url}">${url.url}</a></li>`
      ).join('');
      
      // Send email
      const mailOptions = {
        from: `Event Alert <${functions.config().email.user}>`,
        to: notification.recipientEmail,
        subject: 'Website Changes Detected',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4285f4;">Website Changes Detected</h2>
            <p>Hello ${recipientName},</p>
            <p>We've detected changes on the following websites:</p>
            <ul>
              ${urlList}
            </ul>
            <p>Log in to the Event Alert Extension to view details of these changes.</p>
            <p>Best regards,<br>Event Alert Team</p>
          </div>
        `
      };
      
      // Send the email
      await transporter.sendMail(mailOptions);
      
      // Update notification status
      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Notification email sent to ${notification.recipientEmail}`);
      return null;
      
    } catch (error) {
      console.error('Error sending notification email:', error);
      
      // Update notification with error details
      await snap.ref.update({
        status: 'error',
        error: error.message
      });
      
      return null;
    }
  });

/**
 * Cloud Function that runs on a schedule to process daily digests
 */
exports.sendDailyDigest = functions.pubsub
  .schedule('0 9 * * *') // Run at 9 AM every day
  .timeZone('America/New_York')
  .onRun(async (context) => {
    return await processDigests('daily');
  });

/**
 * Cloud Function that runs on a schedule to process weekly digests
 */
exports.sendWeeklyDigest = functions.pubsub
  .schedule('0 9 * * MON') // Run at 9 AM every Monday
  .timeZone('America/New_York')
  .onRun(async (context) => {
    return await processDigests('weekly');
  });

/**
 * Helper function to process digests
 */
async function processDigests(digestType) {
  console.log(`Processing ${digestType} digests`);
  
  try {
    const now = admin.firestore.Timestamp.now();
    const oneDayAgo = new Date(now.toMillis() - (24 * 60 * 60 * 1000));
    const oneWeekAgo = new Date(now.toMillis() - (7 * 24 * 60 * 60 * 1000));
    
    // Get the cutoff time based on digest type
    const cutoffTime = digestType === 'daily' ? oneDayAgo : oneWeekAgo;
    
    // Group digest entries by user
    const digestEntriesSnapshot = await admin.firestore()
      .collection('digestQueue')
      .where('digestType', '==', digestType)
      .where('createdAt', '>=', cutoffTime)
      .get();
    
    if (digestEntriesSnapshot.empty) {
      console.log(`No ${digestType} digests to process`);
      return null;
    }
    
    // Group by user ID and email
    const userDigests = {};
    
    digestEntriesSnapshot.forEach(doc => {
      const entry = doc.data();
      const key = `${entry.userId}:${entry.recipientEmail}`;
      
      if (!userDigests[key]) {
        userDigests[key] = {
          userId: entry.userId,
          email: entry.recipientEmail,
          changedURLs: [],
          docIds: []
        };
      }
      
      // Add URLs to the list, avoiding duplicates
      entry.changedURLs.forEach(url => {
        if (!userDigests[key].changedURLs.some(existing => existing.id === url.id)) {
          userDigests[key].changedURLs.push(url);
        }
      });
      
      // Track doc IDs for cleanup
      userDigests[key].docIds.push(doc.id);
    });
    
    // Process each user's digest
    const batch = admin.firestore().batch();
    const promises = [];
    
    for (const key in userDigests) {
      const digest = userDigests[key];
      
      // Get user details
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(digest.userId)
        .get();
      
      const userData = userDoc.exists ? userDoc.data() : {};
      const recipientName = userData.displayName || 'User';
      
      // Create URLs list for email
      const urlList = digest.changedURLs.map(url => 
        `<li><a href="${url.url}">${url.url}</a></li>`
      ).join('');
      
      // Send email
      const mailOptions = {
        from: `Event Alert <${functions.config().email.user}>`,
        to: digest.email,
        subject: `${digestType === 'daily' ? 'Daily' : 'Weekly'} Website Changes Digest`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4285f4;">${digestType === 'daily' ? 'Daily' : 'Weekly'} Website Changes Digest</h2>
            <p>Hello ${recipientName},</p>
            <p>Here's a summary of website changes detected in the ${digestType === 'daily' ? 'past day' : 'past week'}:</p>
            <ul>
              ${urlList}
            </ul>
            <p>Log in to the Event Alert Extension to view details of these changes.</p>
            <p>Best regards,<br>Event Alert Team</p>
          </div>
        `
      };
      
      // Send the email and record it in a notification document
      promises.push(
        transporter.sendMail(mailOptions)
          .then(async () => {
            // Create a record of the sent digest
            await admin.firestore().collection('notifications').add({
              userId: digest.userId,
              changedURLs: digest.changedURLs,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
              status: 'sent',
              notificationType: 'email',
              digestType: digestType,
              recipientEmail: digest.email
            });
            
            // Mark digest queue entries as processed
            digest.docIds.forEach(docId => {
              const ref = admin.firestore().collection('digestQueue').doc(docId);
              batch.delete(ref);
            });
          })
      );
    }
    
    // Wait for all emails to be sent
    await Promise.all(promises);
    
    // Commit batch to remove processed entries
    await batch.commit();
    
    console.log(`${digestType} digest processing complete`);
    return null;
    
  } catch (error) {
    console.error(`Error processing ${digestType} digests:`, error);
    return null;
  }
}