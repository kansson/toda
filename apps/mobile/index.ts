// Before anything else: TanStack DB needs Web Crypto, which Hermes lacks.
import './src/data/polyfills'
// Reminder buttons run while the app is closed, so their task is defined before any screen.
import './src/reminders/background'
import 'expo-router/entry'
