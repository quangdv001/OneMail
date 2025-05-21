import { ILoadOptionsFunctions, INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

export class OneMail implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details will go here
		displayName: 'One Mail',
		name: 'oneMail',
		icon: 'file:onemail.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Push data to One Mail API',
		defaults: {
			name: 'One Mail',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'oneMailApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.onestop.bizdev.vn',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			// Resources and operations will go here
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Automation',
						value: 'automation',
					},
				],
				default: 'automation',
			},
			// Operations will go here
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [
							'automation',
						],
					},
				},
				options: [
					{
						name: 'Import Subscriber',
						value: 'import_subscriber',
						action: 'Import subscriber',
						description: 'Import subscriber to One Mail Automation',
						routing: {
							request: {
								method: 'POST',
								url: '/api/bizfly/mail/automations/import-subscribe-manual',
							},
						},
					},
				],
				default: 'import_subscriber',
			},
			{
				displayName: 'Automation Name or ID',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				required: true,
				name: 'uuid',
				type: 'options',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getAutomations',
				},
				routing: {
					request: {
						body: {
							uuid: '={{$parameter["uuid"]}}',
						},
					},
				},
				displayOptions: {
					show: {
						resource: [
							'automation',
						],
					},
				},
			},
			{
				displayName: 'Email',
				description: 'Email to import',
				required: true,
				name: 'email',
				type: 'string',
				placeholder: 'Enter email',
				default: '',
				routing: {
					request: {
						body: {
							email: '={{$parameter["email"]}}',
						},
					},
				},
				displayOptions: {
					show: {
						resource: [
							'automation',
						],
					},
				},
			},
			{
				displayName: 'Contact Fields',
				name: 'contactFieldsUi',
				type: 'fixedCollection',
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'contactFields',
						displayName: 'Contact Fields',
						values: [
							{
                displayName: 'Contact Field Name or ID',
                name: 'key',
                type: 'options',
								description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
								required: true,
                options: [], // Will be filled dynamically in loadOptionsMethod
                typeOptions: {
                  loadOptionsMethod: 'getContactFields',
                },
                default: '',
              },
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Enter value as string, number, date (ISO), or JSON for arrays/objects',
							},
						],
					},
				],
				routing: {
					request: {
						body: {
							customFields: '={{$value}}', // We'll use the value from the preSend function
						},
					},
					send: {
						preSend: [
							async function(this, requestOptions) {
								// Get the contact fields from the parameters
								const contactFields = this.getNodeParameter('contactFieldsUi.contactFields', []) as Array<{
									key: string;
									value: string;
								}>;

								// Get the field types directly from the API
								const credentials = await this.getCredentials('oneMailApi');
								const fieldsResponse = await this.helpers.request({
									method: 'GET',
									url: 'https://api.onestop.bizdev.vn/api/bizfly/mail/fields',
									headers: {
										'X-BCP-API-KEY': `${credentials.apiKey}`,
									},
									json: true,
								});

								// Create a map of field keys to their types
								const fieldTypesMap: Record<string, string> = {};
								fieldsResponse.data.forEach((field: any) => {
									fieldTypesMap[field.key] = field.type;
								});

								// Transform to include type information
								const processedFields = contactFields.map(field => ({
									key: field.key,
									value: field.value,
									type: fieldTypesMap[field.key] || 'text' // Default to text if type not found
								}));

								// Set the processed fields directly in the request body
								requestOptions.body.customFields = processedFields;

								return requestOptions;
							},
						],
					},
				},
				displayOptions: {
					show: {
						resource: [
							'automation',
						],
					},
				},
			}

		]
	};

	methods = {
		loadOptions: {
			// Gọi API và trả về danh sách options
			async getAutomations(this: ILoadOptionsFunctions) {
				const credentials = await this.getCredentials('oneMailApi');

				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://api.onestop.bizdev.vn/api/bizfly/mail/automations',
					headers: {
						'X-BCP-API-KEY': `${credentials.apiKey}`,
					},
					json: true,
				});

				// Giả sử API trả về: [{ id: 1, name: 'User A' }, { id: 2, name: 'User B' }]
				return (response.data as Array<{ uuid: string; name: string }>).map(automation => ({
					name: automation.name,
					value: automation.uuid,
				}));
			},
			async getContactFields(this: ILoadOptionsFunctions) {
				const credentials = await this.getCredentials('oneMailApi');

				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://api.onestop.bizdev.vn/api/bizfly/mail/fields',
					headers: {
						'X-BCP-API-KEY': `${credentials.apiKey}`,
					},
					json: true,
				});

				// Giả sử API trả về: [{ id: 1, name: 'User A' }, { id: 2, name: 'User B' }]

				return response.data.map((field: any) => ({
					name: `${field.label} (${field.key})`,
					value: field.key,
					description: field.type,
				}));
			},
		},
	};
}
