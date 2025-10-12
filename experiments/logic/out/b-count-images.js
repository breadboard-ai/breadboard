export default async (inputs) => {
  const { input1 } = inputs;

  if (!input1 || !Array.isArray(input1.parts)) {
    return {
      parts: [{ text: "0" }],
    };
  }

  let imageCount = 0;
  for (const part of input1.parts) {
    const mimeType = part.fileData?.mimeType ?? part.inlineData?.mimeType;
    if (mimeType && mimeType.startsWith("image/")) {
      imageCount++;
    }
  }

  return {
    parts: [{ text: String(imageCount) }],
  };
};