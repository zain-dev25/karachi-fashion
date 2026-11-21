# Karachi Fashion

The existing storefront remains the home page. The admin catalogue is available at `/admin.html` and stores products in Cloud Firestore. Product image files upload directly to Cloudinary using an unsigned, restricted upload preset.

## One-time provider setup

1. Create a Firebase project and register a Web app. Enable **Authentication → Email/Password**, create the Firestore database, and create the first admin user with the email you will put in `VITE_ADMIN_EMAIL`.
2. Create a Cloudinary unsigned upload preset. Restrict it to image formats and set an upload size limit. The preset name and cloud name are public client configuration; do not put a Cloudinary API secret in this app.
3. Copy `.env.example` to `.env` and enter the Firebase Web app values, Firebase project ID, `VITE_ADMIN_EMAIL`, Cloudinary cloud name/preset, WhatsApp number, and TikTok profile URL.
4. Run `npx firebase-tools login` once, then `npm run deploy`. This builds the site and deploys Hosting, Firestore rules, and the admin bootstrap function. Firebase Functions deployment requires a billing-enabled Firebase project.
5. Open `/admin.html` on the deployed site and sign in with the Firebase user created in step 1. The callable function grants that exact configured email the admin claim. On first successful admin sign-in, the existing hard-coded storefront catalogue is imported into Firestore; after that Firestore is the source of truth.

After the provider setup, update the root `.env` and run `npm run deploy` for changes. The deploy script writes the admin email to an ignored, project-specific Functions env file automatically.

## Local development

```sh
npm install
npm run dev
```

Open the Vite URL for the storefront or append `/admin.html`. Admin sign-in and writes require the deployed Firebase Function and Firestore rules. If Firebase variables are blank, the home page continues to show its existing static catalogue.

## Product fields

Products support category, title, caption, badge, price, compare-at price, description, image URL, sort position, visibility, and featured-card layout. Hiding a product keeps it in the admin list but removes it from the public storefront. Deleting a product removes its Firestore document; Cloudinary media is not automatically deleted, so unused image assets may need cleanup in Cloudinary.

## Access and uploads

Public Firestore reads are restricted to active products. Create, update, and delete require the Firebase custom admin claim, which only the `bootstrapAdmin` callable can grant to the configured admin email. Keep Firestore rules deployed with the project. Cloudinary unsigned presets are intentionally usable by the browser, so restrict allowed formats, file size, and upload folder in the Cloudinary console.