"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function McqRowActions({
	mcqId,
	name,
	onDelete,
}: {
	mcqId: string;
	name: string;
	onDelete: (mcqId: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				type="button"
				aria-label={`Actions for ${name}`}
				className={buttonVariants({ variant: "ghost", size: "icon" })}
			>
				<MoreVertical aria-hidden />
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end">
				<DropdownMenuItem render={<Link href={`/dashboard/mcqs/${mcqId}/edit`} />}>
					Edit
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link href={`/dashboard/mcqs/${mcqId}/preview`} />}>
					Preview
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onClick={() => onDelete(mcqId)}>
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
