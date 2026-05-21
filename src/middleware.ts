import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/schemas(.*)",
  "/api/registries(.*)",
  "/api/designer(.*)",
  "/designer(.*)",
  "/r/[a-zA-Z0-9]{6}",
  "/lp(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Demo bypass — skip auth when ?demo=true (remove after presentation)
  const url = new URL(request.url);
  if (url.searchParams.get("demo") === "true") return;

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
