export default async (inputs) => {
  const { input1 } = inputs;

  if (!input1 || !Array.isArray(input1.parts)) {
    return {
      parts: [{ text: "0" }]
    };
  }

  const imageCount = input1.parts.filter(part => {
    const mimeType = part.fileData?.mimeType || part.inlineData?.mimeType;
    return mimeType?.startsWith("image/");
  }).length;

  return {
    parts: [{ text: String(imageCount) }]
  };
};