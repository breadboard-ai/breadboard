export default async (inputs, capabilities) => {
  let imageCount = 0;

  if (inputs && inputs.parts) {
    for (const part of inputs.parts) {
      if (part.fileData && part.fileData.mimeType.startsWith("image/")) {
        imageCount++;
      } else if (part.inlineData && part.inlineData.mimeType.startsWith("image/")) {
        imageCount++;
      }
    }
  }

  return {
    parts: [{
      text: `${imageCount}`
    }],
  };
};