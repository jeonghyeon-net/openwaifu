import { z } from "zod";

export const embedFieldSchema = z.object({
	name: z.string(),
	value: z.string(),
	inline: z.boolean().optional(),
});

export const embedSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	url: z.string().optional(),
	color: z.number().optional(),
	footer: z
		.object({ text: z.string(), icon_url: z.string().optional() })
		.optional(),
	image: z.object({ url: z.string() }).optional(),
	thumbnail: z.object({ url: z.string() }).optional(),
	author: z
		.object({
			name: z.string(),
			url: z.string().optional(),
			icon_url: z.string().optional(),
		})
		.optional(),
	fields: z.array(embedFieldSchema).optional(),
});
