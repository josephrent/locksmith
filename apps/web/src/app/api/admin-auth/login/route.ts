import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 60 * 60 * 24; // 24 hours

function sign(secret: string, exp: string): string {
  return crypto.createHmac("sha256", secret).update(exp).digest("base64url");
}

function checkCredentials(username: string, password: string): boolean {
  const u1 = process.env.ADMIN_USERNAME;
  const p1 = process.env.ADMIN_PASSWORD;
  const u2 = process.env.ADMIN_USERNAME_2;
  const p2 = process.env.ADMIN_PASSWORD_2;
  if (u1 && p1 && username === u1 && password === p1) return true;
  if (u2 && p2 && username === u2 && password === p2) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Admin auth not configured" },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400 }
    );
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  if (!checkCredentials(username, password)) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const sig = sign(secret, exp);
  const value = `${exp}.${sig}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
