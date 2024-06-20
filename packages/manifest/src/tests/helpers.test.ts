export function getMockedFetchResponse(mockedResponse: any) {
	return {
		then: (cb: any) => cb({json: () => Promise.resolve(mockedResponse)}),
		status: 200,
	};
}

export function getMockedAsyncReadFileResponse(mockedResponse: any): {
	then: (cb: any) => any;
} {
	return {then: (cb: any) => cb(JSON.stringify(mockedResponse))};
}

export function getReadFileSyncResponse(mockedResponse: any): string {
	return JSON.stringify(mockedResponse);
}
