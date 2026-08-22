import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class JustTranscribeApi implements ICredentialType {
	name = 'justTranscribeApi';

	displayName = 'JustTranscribe API';

	icon: Icon = { light: 'file:justtranscribe.svg', dark: 'file:justtranscribe.dark.svg' };

	documentationUrl = 'https://justtranscribe.ai/developers';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description:
				'Your JustTranscribe API key (starts with jt_live_). Create one for free at justtranscribe.ai → Profile → API keys.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{ $credentials.apiKey }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://justtranscribe.ai',
			url: '/api/v1/me',
			method: 'GET',
		},
	};
}
