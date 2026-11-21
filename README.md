# Karachi Fashion

The existing storefront remains the home page. The admin catalogue is available at `/admin.html` and stores products in Cloud Firestore. Product image files upload directly to Cloudinary using an unsigned, restricted upload preset.

## One-time provider setup

1. Create a Firebase project and register a Web app. Enable **Authentication → Email/Password**, create the Firestore database, and create the admin user with the email you will put in `VITE_ADMIN_EMAIL`.
2. Create a Cloudinary unsigned upload preset. Restrict it to image formats and set an upload size limit. The preset name and cloud name are public client configuration; do not put a Cloudinary API secret in this app.
3. Add the Firebase Web app values, Firebase project ID, `VITE_ADMIN_EMAIL`, Cloudinary cloud name/preset, WhatsApp number, and TikTok profile URL to `.env`. Set `VITE_FIREBASE_FUNCTIONS_REGION` to the region where `bootstrapAdmin` is deployed; it defaults to `us-central1`.
4. Run `npx firebase-tools login` once, then `npm run deploy`. This builds the site and deploys Hosting and Firestore rules. Functions are not required for admin login or deployment.
5. Open `/admin.html` on the deployed site and sign in with the Firebase user created in step 1. Only the exact `VITE_ADMIN_EMAIL` can access the dashboard and write products. On first successful admin sign-in, the existing hard-coded storefront catalogue is imported into Firestore; after that Firestore is the source of truth.

After the provider setup, update the root `.env` and run `npm run deploy` for changes. The deploy script inserts the configured admin email into an ignored generated Firestore Rules file before deploying. Admin login does not call a Cloud Function, so a `bootstrapAdmin` CORS error cannot block sign-in.

## Local development

```sh
npm install
npm run dev
```

Open the Vite URL for the storefront or append `/admin.html`. Admin sign-in and writes require Firebase Authentication, a configured `VITE_ADMIN_EMAIL`, and the deployed Firestore Rules. If Firebase variables are blank, the home page continues to show its existing static catalogue.

## Product fields

Products support category, title, caption, badge, price, compare-at price, description, image URL, sort position, visibility, and featured-card layout. Hiding a product keeps it in the admin list but removes it from the public storefront. Deleting a product removes its Firestore document; Cloudinary media is not automatically deleted, so unused image assets may need cleanup in Cloudinary.

## Access and uploads

Public Firestore reads are restricted to active products. Create, update, and delete require a signed-in Firebase Auth user whose email exactly matches the configured admin email. The generated rules enforce this on the server; the client-side email check is only for the dashboard experience. Keep Firestore rules deployed with the project. Cloudinary unsigned presets are intentionally usable by the browser, so restrict allowed formats, file size, and upload folder in the Cloudinary console.