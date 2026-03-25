// src/middleware/auth.ts
// JWT authentication and role-based authorization middleware.
// This service validates JWTs independently — it shares the same
// JWT_SECRET as auth-service but does not call auth-service at runtime.

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { sendError } from "../utils/response";

// ── JWT Payload shape (matches auth-service token) ────────────────────────────
export interface JwtPayload {
  sub:      string;   // user id
  username: string;
  role:     "admin" | "user";
  iat?:     number;
  exp?:     number;
}

// Extend Express Request to carry the decoded payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * authenticateJWT
 * Extracts the Bearer token from the Authorization header,
 * verifies it with the shared JWT_SECRET, and attaches the
 * decoded payload to req.user.
 */
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "Authorization header missing or malformed", 401);
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendError(res, "Token has expired", 401);
    } else if (err instanceof jwt.JsonWebTokenError) {
      sendError(res, "Invalid token", 401);
    } else {
      sendError(res, "Authentication failed", 401);
    }
  }
}

/**
 * authorizeRole
 * Factory that returns middleware restricting access to specific roles.
 *
 * Usage:
 *   router.post("/books", authenticateJWT, authorizeRole("admin"), handler)
 */
export function authorizeRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Not authenticated", 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, `Access denied. Required role(s): ${roles.join(", ")}`, 403);
      return;
    }
    next();
  };
}
