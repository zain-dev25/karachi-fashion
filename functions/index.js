import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const adminEmail = defineString("ADMIN_EMAIL");

export const bootstrapAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before requesting admin access.");
  }

  const signedInEmail = request.auth.token.email?.toLowerCase();
  if (!signedInEmail || signedInEmail !== adminEmail.value().trim().toLowerCase()) {
    throw new HttpsError("permission-denied", "This account is not the configured store administrator.");
  }

  const user = await getAuth().getUser(request.auth.uid);
  await getAuth().setCustomUserClaims(request.auth.uid, {
    ...user.customClaims,
    admin: true,
  });

  return { admin: true };
});