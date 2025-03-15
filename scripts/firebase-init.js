// Firebase configuration
// Initialize Firebase app

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Initialize Firebase services
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // Authentication functions
  const firebaseAuth = {
    // Sign up with email and password
    signUp: async (email, password) => {
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        return userCredential.user;
      } catch (error) {
        console.error("Error signing up:", error);
        throw error;
      }
    },
  
    // Sign in with email and password
    signIn: async (email, password) => {
      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return userCredential.user;
      } catch (error) {
        console.error("Error signing in:", error);
        throw error;
      }
    },
  
    // Sign out
    signOut: async () => {
      try {
        await auth.signOut();
      } catch (error) {
        console.error("Error signing out:", error);
        throw error;
      }
    },
  
    // Get current user
    getCurrentUser: () => {
      return auth.currentUser;
    },
  
    // Set up auth state observer
    onAuthStateChanged: (callback) => {
      return auth.onAuthStateChanged(callback);
    }
  };
  
  // Firestore functions
  const firestoreDB = {
    // Add URL to monitor
    addURL: async (url, selector, frequency) => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");
  
        const urlData = {
          url: url,
          selector: selector,
          frequency: frequency,
          userId: user.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastChecked: null,
          lastContent: "",
          enabled: true
        };
  
        const docRef = await db.collection("monitoredURLs").add(urlData);
        return docRef.id;
      } catch (error) {
        console.error("Error adding URL:", error);
        throw error;
      }
    },
  
    // Get all URLs for current user
    getUserURLs: async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");
  
        const snapshot = await db.collection("monitoredURLs")
          .where("userId", "==", user.uid)
          .get();
  
        const urls = [];
        snapshot.forEach(doc => {
          urls.push({
            id: doc.id,
            ...doc.data()
          });
        });
  
        return urls;
      } catch (error) {
        console.error("Error getting URLs:", error);
        throw error;
      }
    },
  
    // Update URL monitoring settings
    updateURL: async (urlId, data) => {
      try {
        await db.collection("monitoredURLs").doc(urlId).update(data);
      } catch (error) {
        console.error("Error updating URL:", error);
        throw error;
      }
    },
  
    // Delete URL from monitoring
    deleteURL: async (urlId) => {
      try {
        await db.collection("monitoredURLs").doc(urlId).delete();
      } catch (error) {
        console.error("Error deleting URL:", error);
        throw error;
      }
    },
  
    // Get user preferences
    getUserPreferences: async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");
  
        const doc = await db.collection("userPreferences").doc(user.uid).get();
        
        if (doc.exists) {
          return doc.data();
        } else {
          // Create default preferences if none exist
          const defaultPreferences = {
            emailNotifications: true,
            notificationEmail: user.email,
            notificationFrequency: "immediate"
          };
          
          await db.collection("userPreferences").doc(user.uid).set(defaultPreferences);
          return defaultPreferences;
        }
      } catch (error) {
        console.error("Error getting user preferences:", error);
        throw error;
      }
    },
  
    // Update user preferences
    updateUserPreferences: async (preferences) => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");
  
        await db.collection("userPreferences").doc(user.uid).update(preferences);
      } catch (error) {
        console.error("Error updating user preferences:", error);
        throw error;
      }
    }
  };
  
  // Export firebase modules
  const firebaseModule = {
    auth: firebaseAuth,
    db: firestoreDB
  };