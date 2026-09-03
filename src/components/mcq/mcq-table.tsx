"use client";

import { useState } from "react";
import Link from "next/link";

import { DeleteMcqDialog } from "@/components/mcq/delete-mcq-dialog";
import { McqRowActions } from "@/components/mcq/mcq-row-actions";
import { buttonVariants } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type McqTableItem = {
	id: string;
	name: string;
	question: string;
};

export function McqTable({ items }: { items: McqTableItem[] }) {
	const [deleteId, setDeleteId] = useState<string | null>(null);

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="flex justify-end">
				<Link href="/dashboard/mcqs/new" className={buttonVariants()}>
					Create
				</Link>
			</div>

			{items.length === 0 ? (
				<p className="text-muted-foreground">No questions yet.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Question</TableHead>
							<TableHead>Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((item) => (
							<TableRow key={item.id}>
								<TableCell>{item.name}</TableCell>
								<TableCell>{item.question}</TableCell>
								<TableCell>
									<McqRowActions
										mcqId={item.id}
										name={item.name}
										onDelete={setDeleteId}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<DeleteMcqDialog
				mcqId={deleteId}
				open={deleteId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteId(null);
					}
				}}
			/>
		</div>
	);
}
