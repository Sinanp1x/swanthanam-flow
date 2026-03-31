import { Redirect } from "expo-router";
import { useState } from "react";

export default function Index() {
  // In a real app, this comes from Firebase or a Database
  const [isLoggedIn] = useState(false);

  if (!isLoggedIn) {
    // If not logged in, send them to the login page
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}