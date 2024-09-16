import type { Request, Response, NextFunction } from 'express';
import { getStore } from '../../server/store.js';

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const store = getStore();

  // Extract API_KEY from query parameters
  const userKey = req.query.API_KEY as string;

  if (!userKey) {
    res.status(401).json({ error: "Unauthorized: API_KEY is missing" });
    return;
  }

  // Check if the user exists in the store
  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    res.status(401).json({ error: "Unauthorized: Invalid API_KEY" });
    return;
  }

  // Check if the user from API_KEY matches the :user parameter
  if (req.params.user && req.params.user !== userStore.store!) {
    res.status(403).json({ error: "Forbidden: User mismatch" });
    return;
  }

  // Add the username to the response object for later use
  res.locals.username = userStore.store!;
  
  next();
};

export default authenticate;
