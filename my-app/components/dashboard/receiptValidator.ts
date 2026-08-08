import { createWorker } from 'tesseract.js';

interface ValidationOptions {
  expectedAmount?: number;
  expectedRecipient?: string;
}

interface ValidationResult {
  isValid: boolean;
  extractedText: string;
  confidence: number;
  errors: string[];
}

export async function validateReceiptImage(
  imageSource: File | string, 
  expectedData: ValidationOptions = {}
): Promise<ValidationResult> {
  const { expectedAmount } = expectedData;
  const errors: string[] = [];
  
  const worker = await createWorker('eng');

  try {
    const { data: { text, confidence } } = await worker.recognize(imageSource);
    await worker.terminate();

    const cleanText = text.toLowerCase();

    // 1. Check Confidence Level
    if (confidence < 30) {
      errors.push("Image quality is too low or text is unreadable.");
    }

    // 2. Strict Financial Keywords Check
    // Must contain clear markers of a digital wallet or bank transfer receipt
    const financialKeywords = [
      'gcash', 'maya', 'paymaya', 'bpi', 'bdo', 'unionbank', 'metrobank', 
      'landbank', 'rcbc', 'pnb', 'chinabank', 'successful', 'success', 
      'transfer', 'sent', 'reference', 'ref no', 'transaction', 'receipt', 'account name'
    ];

    // Count how many financial keywords match the image text
    const matchedKeywordsCount = financialKeywords.filter(keyword => cleanText.includes(keyword)).length;

    // Require at least 2 matching financial terms to qualify as a valid payment screenshot
    if (matchedKeywordsCount < 2) {
      errors.push("Invalid receipt: The image does not contain recognizable payment or transfer slip details.");
    }

    // 3. Optional: Validate Amount if provided
    if (expectedAmount !== undefined && expectedAmount !== null && expectedAmount > 0) {
      const amountStr = Number(expectedAmount).toFixed(2);
      const normalizedText = cleanText.replace(/,/g, '');
      const normalizedExpected = amountStr.replace(/,/g, '');

      if (!normalizedText.includes(normalizedExpected)) {
        errors.push(`Amount mismatch: Could not find the expected amount (₱${amountStr}) on the receipt.`);
      }
    }

    return {
      isValid: errors.length === 0 && errors.length === 0,
      extractedText: text,
      confidence,
      errors
    };

  } catch (error) {
    await worker.terminate();
    console.error("Tesseract OCR Error:", error);
    return {
      isValid: false,
      extractedText: "",
      confidence: 0,
      errors: ["Failed to process the receipt image."]
    };
  }
}