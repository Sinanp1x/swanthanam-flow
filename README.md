# Swanthanam Flow

![Swanthanam Flow Icon](assets/images/favicon.png)

Swanthanam Flow is a stock recorder and tracking app built for the Swanthanam palliative initiative by SYS in Kerala.

The app is designed to simplify local medical equipment lending operations, especially for items such as wheelchairs, oxygen cylinders, hospital beds, and other care equipment.

It tracks:
- Inventory categories and child items
- Item status (available, lended, broken)
- Checkout sessions linked to patients
- Check-in and return flow by session period
- Lending history for operational follow-up

The goal is to replace rigorous manual log writing with a simple pocket workflow for volunteers and coordinators.

## Important Scope Note

> ### 🛑 Private Project Disclaimer
> This software is custom-built for a specific palliative care unit (**Swanthanam Flow**). It is shared here for **portfolio and educational purposes only**.
> * **Usage:** Unauthorized use of this specific instance is prohibited.
> * **No Warranty:** As a first-year engineering project, this is provided "as-is."
> * **Contributions:** Not currently accepting public pull requests.

This is not a general-purpose public app.

Swanthanam Flow was developed specifically for one local branch in my village and is intended only for that focused operational context.

## Tech Stack

- Expo + React Native
- Expo Go
- Expo Router
- Supabase (Auth, Postgres, Storage, RPC)
- TypeScript

### Tech Stack with Icons

[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Expo%20Go](https://img.shields.io/badge/Expo%20Go-1C1E24?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/go)
[![React%20Native](https://img.shields.io/badge/React%20Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo%20Router](https://img.shields.io/badge/Expo%20Router-000020?style=for-the-badge&logo=expo&logoColor=white)](https://docs.expo.dev/router/introduction/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Project Setup

1. Install dependencies

   npm install

2. Start development server

   npx expo start

3. Run lint checks

   npm run lint

## Core Modules

- Authentication: login and signup for committee use
- Inventory: category and item management with image support
- Checkout: assign equipment to patient under session
- Check-in: return items and close session when complete
- History: session-level lending records
- Profile: user info, unit details, and profile image

## Internal Use

This app is maintained for practical field use in the Swanthanam workflow and tuned to local operational needs.
