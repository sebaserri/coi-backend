import { Response } from "express";
import {
  CSRF_COOKIE,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cookieBase,
} from "./auth.constants";

export function setAccessCookie(res: Response, token: string, minutes: number) {
  const maxAge = minutes * 60 * 1000;
  res.cookie(ACCESS_COOKIE, token, cookieBase({ maxAge }));
}

export function setRefreshCookie(res: Response, token: string, days: number) {
  const maxAge = days * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE, token, cookieBase({ maxAge }));
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieBase());
  res.clearCookie(REFRESH_COOKIE, cookieBase());
  // csrf cookie no es httpOnly; ver abajo
}

export function setCsrfCookie(res: Response, csrf: string) {
  // double-submit: cookie accesible por JS para enviarla en header
  res.cookie(CSRF_COOKIE, csrf, {
    ...cookieBase(),
    httpOnly: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
