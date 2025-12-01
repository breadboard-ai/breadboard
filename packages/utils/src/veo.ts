export const veoDailyLimitStorageKey = "veoDailyLimitReached";

export const isVeoDailyLimitReached = () => {
  const itemStr = localStorage.getItem(veoDailyLimitStorageKey);
  if (!itemStr) {
    return false;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiresAt) {
    // Item has expired, remove from storage
    localStorage.removeItem(veoDailyLimitStorageKey);
    return false;
  }

  return true;
};

export const setVeoDailyLimitExpirationKey = () => {
  localStorage.setItem(
    veoDailyLimitStorageKey,
    JSON.stringify({
      value: "yes",
      expiresAt: new Date().getTime() + 24 * 60 * 60 * 1000,
    })
  );
};

export const removeVeoDailyLimitExpirationKey = () => {
  localStorage.removeItem(veoDailyLimitStorageKey);
};
