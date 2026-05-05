"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import Header from "@/src/components/layout/Header";
import Sidebar from "@/src/components/layout/Sidebar";
import { clearAuth, getAuthToken } from "@/src/lib/auth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getAuthToken();
    const userRaw = localStorage.getItem("wakama_user");
    const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : "fr";

    if (!token) {
      router.replace(`/${locale}/login`);
      return;
    }

    try {
      if (userRaw) JSON.parse(userRaw);
    } catch {
      clearAuth();
      router.replace(`/${locale}/login`);
    }
  }, [pathname, router]);

  return (
    <div className="flex h-full bg-bg-primary">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ height: "calc(100vh - 64px)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
