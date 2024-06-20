import { randomUUID } from "crypto";
import { BreadboardManifest } from "../index";
import { DereferencedBoard, DereferencedManifest, ReferencedBoard, ReferencedManifest } from "../types";
import path from "path";

export const dereferencedBoard = (): DereferencedBoard => ({edges: [], nodes: []});
export const dereferencedManifest = (): DereferencedManifest => ({
	title: "Dereferenced Manifest",
	boards: [],
	manifests: [],
});
export const localBoardReference = (): ReferencedBoard => ({
	title: "Local Board Reference",
	url: generateLocalFilePath(".bgl.json"),
});
export const remoteBoardReference = (): ReferencedBoard => ({
	title: "Remote Board Reference",
	url: generateGistURL(),
});
export const localManifestReference = (): ReferencedManifest => ({
	title: "Local Manifest Reference",
	url: generateLocalFilePath(".bbm.json"),
});
export const remoteManifestReference = (): ReferencedManifest => ({
	title: "Remote Manifest Reference",
	url: generateGistURL(),
});
export const manifestArray = (): BreadboardManifest[] => [
	{title: "Manifest with an empty boards array", boards: []},
	{title: "Manifest with an empty manifests array", manifests: []},
	{
		title: "Manifest with empty boards and manifests arrays",
		boards: [],
		manifests: [
			{
				title: "Gist Manifest",
				url: generateGistURL(),
			},
		],
	},
	{
		title: "Manifest with boards",
		boards: [
			{
				title: "My First Board",
				url: generateGistURL(),
			},
			{
				title: "My Second Board",
				url: generateLocalFilePath(".bgl.json"),
			},
		],
	},
	{
		title: "Manifest with manifests",
		manifests: [
			{
				title: "Gist Manifest",
				url: generateGistURL("manifest.bbm.json"),
			},
		],
	},
	{
		title: "Manifest with boards and manifests",
		boards: [
			{
				title: "My First Board",
				url: generateGistURL(),
			},
			{
				title: "My Second Board",
				url: generateLocalFilePath(".bbm.json"),
			},
		],
		manifests: [
			{
				title: "Gist Manifest",
				url: generateGistURL(),
			},
		],
	},
	{
		title: "Nested manifest",
		manifests: [
			{
				title: "Gist Manifest",
				url: generateGistURL(),
			},
			{
				title: "Nested Nested Manifest",
				boards: [
					{
						title: "My First Board",
						url: generateGistURL(),
					},
				],
				manifests: [
					{
						title: "Nested Nested Nested Manifest",
						boards: [
							{
								title: "My First Board",
								url: generateGistURL(),
							},
						],
					},
				],
			},
		],
	},
	{
		title: "Manifest with a single dereferenced board",
		boards: [dereferencedBoard()],
	},
	{
		title: "Manifest with a single local board reference",
		boards: [localBoardReference()],
	},
	{
		title: "Manifest with a single remote board reference",
		boards: [remoteBoardReference()],
	},
	{
		title: "Manifest with dereferenced, local, and remote boards",
		boards: [
			dereferencedBoard(),
			localBoardReference(),
			remoteBoardReference(),
		],
	},
	{
		title: "Manifest with a single dereferenced manifest",
		manifests: [dereferencedManifest()],
	},
	{
		title: "Manifest with a single local manifest reference",
		manifests: [localManifestReference()],
	},
	{
		title: "Manifest with a single remote manifest reference",
		manifests: [remoteManifestReference()],
	},
	{
		title: "Manifest with dereferenced, local, and remote manifests",
		manifests: [
			dereferencedManifest(),
			localManifestReference(),
			remoteManifestReference(),
		],
	},
];
export const nestedManifest = (): BreadboardManifest => ({
	manifests: [
		{
			manifests: [
				dereferencedManifest(),
				localManifestReference(),
				remoteManifestReference(),
			],
		},
		{manifests: manifestArray()},
		{
			boards: [
				localBoardReference(),
				remoteBoardReference(),
				dereferencedBoard(),
			],
		},
	],
	boards: [localBoardReference(), remoteBoardReference(), dereferencedBoard()],
});


function generateGistURL(extension: string = "file.json"): string {
	return `https://gist.githubusercontent.com/user/${randomUUID()}/raw/${randomUUID()}.${extension}`;
}

function generateLocalFilePath(extension: string = "file.json"): string {
	return encodeURI(path.resolve(`${randomUUID()}.${extension}`));
}