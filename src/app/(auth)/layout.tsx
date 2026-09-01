import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();

	if (user) {
		redirect("/dashboard");
	}

	return <>{children}</>;
}
