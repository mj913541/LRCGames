import { auth, getSchoolId, fnBuyAvatarItem } from "./firebase.js";
import { waitForAuthReady } from "./firebase.js";

async function buyItem(itemId) {
  await waitForAuthReady();

  if (!auth.currentUser) {
    throw new Error("You must be signed in.");
  }

  const schoolId = getSchoolId();

  const result = await fnBuyAvatarItem({
    schoolId,
    itemId,
  });

  return result?.data || result;
}