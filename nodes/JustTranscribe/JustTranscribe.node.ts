import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import type { JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

const BASE_URL = 'https://justtranscribe.ai';

/** Statuses that mean the pipeline is still working. */
const PROCESSING = new Set(['queued', 'pending', 'fetching', 'transcribing', 'analyzing']);

const TEXT_EXPORT_FORMATS = new Set(['txt', 'srt', 'vtt', 'csv', 'md']);

export class JustTranscribe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'JustTranscribe',
		name: 'justTranscribe',
		icon: { light: 'file:justtranscribe.svg', dark: 'file:justtranscribe.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Transcribe audio/video files and public video links (YouTube, TikTok, Instagram, WhatsApp voice notes) into timestamped text with JustTranscribe',
		defaults: {
			name: 'JustTranscribe',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'justTranscribeApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Transcript',
						value: 'transcript',
					},
					{
						name: 'Account',
						value: 'account',
					},
				],
				default: 'transcript',
			},

			// ---------------------------------------------------- transcript ops
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['transcript'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description:
							'Transcribe a public video URL or a binary file; optionally wait until the transcript is ready',
						action: 'Create a transcript',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a transcript and its stored media',
						action: 'Delete a transcript',
					},
					{
						name: 'Export',
						value: 'export',
						description: 'Download a finished transcript as SRT, TXT, DOCX and more',
						action: 'Export a transcript',
					},
					{
						name: 'Get',
						value: 'get',
						description:
							'Get a transcript by ID — status, timestamped segments, language, AI analysis',
						action: 'Get a transcript',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List transcripts on the account, newest first',
						action: 'List transcripts',
					},
				],
				default: 'create',
			},

			// ---------------------------------------------------- account ops
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get the account behind the API key',
						action: 'Get the account',
					},
				],
				default: 'get',
			},

			// ---------------------------------------------------- create
			{
				displayName: 'Source',
				name: 'source',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['create'],
					},
				},
				options: [
					{
						name: 'Video URL',
						value: 'url',
						description:
							'A public YouTube, TikTok, Instagram, Facebook, Pinterest or Google Drive link',
					},
					{
						name: 'Binary File',
						value: 'file',
						description:
							'An audio or video file from a previous node (MP3, WAV, M4A, OGG/OPUS, FLAC, MP4, MOV, WEBM, MKV — up to 500 MB / 150 minutes)',
					},
				],
				default: 'url',
			},
			{
				displayName: 'Video URL',
				name: 'url',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['create'],
						source: ['url'],
					},
				},
				default: '',
				placeholder: 'https://www.youtube.com/watch?v=…',
				description: 'The public video link to transcribe (private or login-only videos cannot be fetched)',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['create'],
						source: ['file'],
					},
				},
				default: 'data',
				hint: 'The name of the input binary field containing the audio or video file',
			},
			{
				displayName: 'Wait Until Finished',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['create'],
					},
				},
				default: true,
				description:
					'Whether to poll until the transcript is complete (or failed) and return it, instead of returning the pending job immediately',
			},
			{
				displayName: 'Max Wait (Seconds)',
				name: 'maxWaitSeconds',
				type: 'number',
				typeOptions: {
					minValue: 30,
					maxValue: 3600,
				},
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['create'],
						waitForCompletion: [true],
					},
				},
				default: 900,
				description:
					'Give up waiting after this many seconds (the transcript keeps processing server-side; fetch it later with Get). A short recording takes about a minute; long ones take several.',
			},

			// ---------------------------------------------------- get / delete / export
			{
				displayName: 'Transcript ID',
				name: 'transcriptId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['get', 'delete', 'export'],
					},
				},
				default: '',
				description: 'The ID returned by Create',
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['export'],
					},
				},
				options: [
					{ name: 'CSV (Segments)', value: 'csv' },
					{ name: 'Markdown', value: 'md' },
					{ name: 'PDF', value: 'pdf' },
					{ name: 'Plain Text', value: 'txt' },
					{ name: 'SRT Subtitles', value: 'srt' },
					{ name: 'WebVTT Subtitles', value: 'vtt' },
					{ name: 'Word (DOCX)', value: 'docx' },
				],
				default: 'srt',
				description: 'Text formats land in the item JSON; PDF and DOCX land in a binary field',
			},
			{
				displayName: 'Options',
				name: 'exportOptions',
				type: 'collection',
				placeholder: 'Add option',
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['export'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Include Timestamps',
						name: 'timestamps',
						type: 'boolean',
						default: true,
						description:
							'Whether to prefix each segment with its timestamp (SRT/VTT keep their cue timings regardless)',
					},
					{
						displayName: 'Include Speaker Labels',
						name: 'speakers',
						type: 'boolean',
						default: false,
						description:
							'Whether to label who is speaking — uses the diarization already cached on the transcript, never triggers a paid detection',
					},
					{
						displayName: 'Put Output File in Field',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						hint: 'Binary field for PDF/DOCX exports',
					},
				],
			},

			// ---------------------------------------------------- list
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['list'],
					},
				},
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				typeOptions: {
					minValue: 0,
				},
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['list'],
					},
				},
				default: 0,
				description: 'Number of transcripts to skip (for pagination)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['transcript'],
						operation: ['list'],
					},
				},
				options: [
					{ name: 'All', value: '' },
					{ name: 'Complete', value: 'complete' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Queued', value: 'queued' },
					{ name: 'Transcribing', value: 'transcribing' },
				],
				default: '',
				description: 'Only return transcripts with this status',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const request = async (options: IHttpRequestOptions): Promise<unknown> =>
			this.helpers.httpRequestWithAuthentication.call(this, 'justTranscribeApi', options);

		const getTranscript = async (id: string): Promise<IDataObject> =>
			(await request({
				method: 'GET',
				url: `${BASE_URL}/api/v1/transcripts/${id}`,
				json: true,
			})) as IDataObject;

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: IDataObject | IDataObject[] = {};
				let binaryOut: INodeExecutionData['binary'];

				if (resource === 'account' && operation === 'get') {
					responseData = (await request({
						method: 'GET',
						url: `${BASE_URL}/api/v1/me`,
						json: true,
					})) as IDataObject;
				} else if (resource === 'transcript' && operation === 'create') {
					const source = this.getNodeParameter('source', i) as string;
					let created: IDataObject;

					if (source === 'url') {
						const url = (this.getNodeParameter('url', i) as string).trim();
						created = (await request({
							method: 'POST',
							url: `${BASE_URL}/api/v1/transcripts`,
							body: { url },
							json: true,
						})) as IDataObject;
					} else {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						const formData = new FormData();
						formData.append(
							'file',
							new Blob([new Uint8Array(buffer)], {
								type: binaryData.mimeType || 'application/octet-stream',
							}),
							binaryData.fileName || 'upload',
						);
						created = (await request({
							method: 'POST',
							url: `${BASE_URL}/api/v1/transcripts`,
							body: formData,
						})) as IDataObject;
					}

					const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;
					if (!waitForCompletion) {
						responseData = created;
					} else {
						const maxWaitSeconds = this.getNodeParameter('maxWaitSeconds', i) as number;
						const id = created.id as string;
						const deadline = Date.now() + maxWaitSeconds * 1000;
						const pollMs = 5000;
						let current: IDataObject = created;
						while (PROCESSING.has(String(current.status))) {
							if (Date.now() > deadline) {
								throw new NodeOperationError(
									this.getNode(),
									`Transcript ${id} is still processing after ${maxWaitSeconds}s — it keeps running server-side; fetch it later with the Get operation.`,
									{ itemIndex: i },
								);
							}
							await sleep(pollMs);
							current = await getTranscript(id);
						}
						if (current.status === 'failed') {
							throw new NodeOperationError(
								this.getNode(),
								`Transcription failed: ${String(current.error ?? 'unknown error')}`,
								{ itemIndex: i },
							);
						}
						responseData = current;
					}
				} else if (resource === 'transcript' && operation === 'get') {
					const id = (this.getNodeParameter('transcriptId', i) as string).trim();
					responseData = await getTranscript(id);
				} else if (resource === 'transcript' && operation === 'list') {
					const limit = this.getNodeParameter('limit', i) as number;
					const offset = this.getNodeParameter('offset', i) as number;
					const status = this.getNodeParameter('status', i) as string;
					const qs: IDataObject = { limit, offset };
					if (status) qs.status = status;
					const body = (await request({
						method: 'GET',
						url: `${BASE_URL}/api/v1/transcripts`,
						qs,
						json: true,
					})) as IDataObject;
					responseData = (body.transcripts as IDataObject[]) ?? [];
				} else if (resource === 'transcript' && operation === 'delete') {
					const id = (this.getNodeParameter('transcriptId', i) as string).trim();
					responseData = (await request({
						method: 'DELETE',
						url: `${BASE_URL}/api/v1/transcripts/${id}`,
						json: true,
					})) as IDataObject;
				} else if (resource === 'transcript' && operation === 'export') {
					const id = (this.getNodeParameter('transcriptId', i) as string).trim();
					const format = this.getNodeParameter('format', i) as string;
					const exportOptions = this.getNodeParameter('exportOptions', i) as {
						timestamps?: boolean;
						speakers?: boolean;
						binaryPropertyName?: string;
					};
					const qs: IDataObject = {};
					if (exportOptions.timestamps === false) qs.ts = '0';
					if (exportOptions.speakers === true) qs.sp = '1';

					if (TEXT_EXPORT_FORMATS.has(format)) {
						const content = (await request({
							method: 'GET',
							url: `${BASE_URL}/api/v1/transcripts/${id}/export/${format}`,
							qs,
							json: false,
						})) as string;
						responseData = { id, format, content };
					} else {
						const buffer = (await request({
							method: 'GET',
							url: `${BASE_URL}/api/v1/transcripts/${id}/export/${format}`,
							qs,
							json: false,
							encoding: 'arraybuffer',
						})) as Buffer;
						const binaryPropertyName = exportOptions.binaryPropertyName || 'data';
						binaryOut = {
							[binaryPropertyName]: await this.helpers.prepareBinaryData(
								Buffer.from(buffer),
								`transcript-${id}.${format}`,
							),
						};
						responseData = { id, format };
					}
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				if (binaryOut) {
					for (const entry of executionData) entry.binary = binaryOut;
				}
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
