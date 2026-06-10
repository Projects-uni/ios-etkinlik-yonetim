import { Redirect } from 'expo-router';

export default function Index() {
  // The actual routing logic is handled by app/_layout.tsx which listens to the session.
  // By default, we redirect to the login screen. If the user is authenticated,
  // app/_layout.tsx will intercept and route to /(tabs).
  return <Redirect href="/login" />;
}
