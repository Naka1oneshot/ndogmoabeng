// Shared validation utilities for edge functions
// Using manual validation to avoid external dependencies in edge functions

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: Record<string, unknown>;
}

// Constants for validation
export const VALIDATION_LIMITS = {
  JOIN_CODE_LENGTH: 6,
  JOIN_CODE_PATTERN: /^[A-Z0-9]{6}$/,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 50,
  CLAN_MAX: 30,
  DEVICE_ID_MAX: 100,
  PLAYER_TOKEN_LENGTH: 32,
  PLAYER_TOKEN_PATTERN: /^[A-Za-z0-9]{32}$/,
  UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ITEM_NAME_MAX: 50,
  ITEM_NAME_PATTERN: /^[A-Za-zÀ-ÿ0-9\s\-_']+$/,
  GENERAL_TEXT_MAX: 200,
};

// Allowed clans list - includes both accented and non-accented for compatibility
export const ALLOWED_CLANS = [
  'Aseyra',
  'Ezkar', 
  'Zoulous',
  'Akila',
  'Keryndes',
  'Akandé', // Canonical (with accent)
  'Akande', // Legacy (without accent) - will be normalized
  'Royaux',
];

/**
 * Normalize clan name to canonical form
 * - 'Akande' -> 'Akandé'
 */
export function normalizeClan(clan: string | null | undefined): string | null {
  if (!clan) return null;
  const c = clan.trim();
  if (c === 'Akande') return 'Akandé';
  return c;
}

/**
 * Validates and sanitizes a string input
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    patternError?: string;
    allowedValues?: string[];
    trim?: boolean;
    sanitize?: boolean;
  } = {}
): ValidationResult {
  const {
    required = false,
    minLength = 0,
    maxLength = VALIDATION_LIMITS.GENERAL_TEXT_MAX,
    pattern,
    patternError,
    allowedValues,
    trim = true,
    sanitize = true,
  } = options;

  // Check if required
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: { [fieldName]: null } };
  }

  // Type check
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  // Trim if needed
  let sanitizedValue = trim ? value.trim() : value;

  // Length checks
  if (sanitizedValue.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  if (sanitizedValue.length > maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
  }

  // Pattern check
  if (pattern && !pattern.test(sanitizedValue)) {
    return { valid: false, error: patternError || `${fieldName} has invalid format` };
  }

  // Allowed values check
  if (allowedValues && !allowedValues.includes(sanitizedValue)) {
    return { valid: false, error: `${fieldName} must be one of: ${allowedValues.join(', ')}` };
  }

  // Sanitize for storage (remove potential script injection)
  if (sanitize) {
    sanitizedValue = sanitizedValue
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }

  return { valid: true, sanitized: { [fieldName]: sanitizedValue } };
}

/**
 * Validates a UUID
 */
export function validateUUID(
  value: unknown,
  fieldName: string,
  required = false
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: { [fieldName]: null } };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (!VALIDATION_LIMITS.UUID_PATTERN.test(value)) {
    return { valid: false, error: `${fieldName} must be a valid UUID` };
  }

  return { valid: true, sanitized: { [fieldName]: value } };
}

/**
 * Validates a positive integer
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
  } = {}
): ValidationResult {
  const { required = false, min = 1, max = Number.MAX_SAFE_INTEGER } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: { [fieldName]: null } };
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (typeof num !== 'number' || isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (!Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }

  return { valid: true, sanitized: { [fieldName]: num } };
}

/**
 * Validates a boolean
 */
export function validateBoolean(
  value: unknown,
  fieldName: string,
  required = false
): ValidationResult {
  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: { [fieldName]: false } };
  }

  if (typeof value !== 'boolean') {
    return { valid: false, error: `${fieldName} must be a boolean` };
  }

  return { valid: true, sanitized: { [fieldName]: value } };
}

/**
 * Join Game Input Validation
 */
export interface JoinGameInput {
  joinCode: string;
  displayName: string;
  clan?: string | null;
  deviceId: string;
  reconnectKey?: string | null;
  useTokenForClan?: boolean;
  lockClan?: boolean;
}

export function validateJoinGameInput(input: unknown): ValidationResult & { data?: JoinGameInput } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const data = input as Record<string, unknown>;
  const result: Partial<JoinGameInput> = {};

  // Validate joinCode
  const joinCodeResult = validateString(data.joinCode, 'joinCode', {
    required: true,
    minLength: VALIDATION_LIMITS.JOIN_CODE_LENGTH,
    maxLength: VALIDATION_LIMITS.JOIN_CODE_LENGTH,
    pattern: VALIDATION_LIMITS.JOIN_CODE_PATTERN,
    patternError: 'Join code must be 6 alphanumeric characters',
  });
  if (!joinCodeResult.valid) return joinCodeResult;
  result.joinCode = (joinCodeResult.sanitized?.joinCode as string).toUpperCase();

  // Validate displayName
  const displayNameResult = validateString(data.displayName, 'displayName', {
    required: true,
    minLength: VALIDATION_LIMITS.DISPLAY_NAME_MIN,
    maxLength: VALIDATION_LIMITS.DISPLAY_NAME_MAX,
    sanitize: true,
  });
  if (!displayNameResult.valid) return displayNameResult;
  result.displayName = displayNameResult.sanitized?.displayName as string;

  // Validate clan (optional, must be from allowed list if provided)
  if (data.clan !== undefined && data.clan !== null && data.clan !== '') {
    const clanResult = validateString(data.clan, 'clan', {
      required: false,
      maxLength: VALIDATION_LIMITS.CLAN_MAX,
      allowedValues: ALLOWED_CLANS,
    });
    if (!clanResult.valid) return clanResult;
    result.clan = clanResult.sanitized?.clan as string;
  } else {
    result.clan = null;
  }

  // Validate deviceId
  const deviceIdResult = validateString(data.deviceId, 'deviceId', {
    required: true,
    maxLength: VALIDATION_LIMITS.DEVICE_ID_MAX,
    sanitize: false, // Device IDs are system-generated
  });
  if (!deviceIdResult.valid) return deviceIdResult;
  result.deviceId = deviceIdResult.sanitized?.deviceId as string;

  // Validate reconnectKey (optional)
  if (data.reconnectKey !== undefined && data.reconnectKey !== null && data.reconnectKey !== '') {
    const reconnectKeyResult = validateString(data.reconnectKey, 'reconnectKey', {
      required: false,
      minLength: VALIDATION_LIMITS.PLAYER_TOKEN_LENGTH,
      maxLength: VALIDATION_LIMITS.PLAYER_TOKEN_LENGTH,
      pattern: VALIDATION_LIMITS.PLAYER_TOKEN_PATTERN,
      patternError: 'Invalid reconnect key format',
    });
    if (!reconnectKeyResult.valid) return reconnectKeyResult;
    result.reconnectKey = reconnectKeyResult.sanitized?.reconnectKey as string;
  } else {
    result.reconnectKey = null;
  }

  // Validate boolean flags
  const useTokenResult = validateBoolean(data.useTokenForClan, 'useTokenForClan');
  if (!useTokenResult.valid) return useTokenResult;
  result.useTokenForClan = useTokenResult.sanitized?.useTokenForClan as boolean;

  const lockClanResult = validateBoolean(data.lockClan, 'lockClan');
  if (!lockClanResult.valid) return lockClanResult;
  result.lockClan = lockClanResult.sanitized?.lockClan as boolean;

  return { valid: true, data: result as JoinGameInput };
}

/**
 * Validate Player Input
 */
export interface ValidatePlayerInput {
  gameId: string;
  playerToken: string;
}

export function validateValidatePlayerInput(input: unknown): ValidationResult & { data?: ValidatePlayerInput } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const data = input as Record<string, unknown>;
  const result: Partial<ValidatePlayerInput> = {};

  // Validate gameId
  const gameIdResult = validateUUID(data.gameId, 'gameId', true);
  if (!gameIdResult.valid) return gameIdResult;
  result.gameId = gameIdResult.sanitized?.gameId as string;

  // Validate playerToken
  const playerTokenResult = validateString(data.playerToken, 'playerToken', {
    required: true,
    minLength: VALIDATION_LIMITS.PLAYER_TOKEN_LENGTH,
    maxLength: VALIDATION_LIMITS.PLAYER_TOKEN_LENGTH,
    pattern: VALIDATION_LIMITS.PLAYER_TOKEN_PATTERN,
    patternError: 'Invalid player token format',
  });
  if (!playerTokenResult.valid) return playerTokenResult;
  result.playerToken = playerTokenResult.sanitized?.playerToken as string;

  return { valid: true, data: result as ValidatePlayerInput };
}

/**
 * Purchase Item Input
 */
export interface PurchaseItemInput {
  gameId: string;
  playerNumber: number;
  itemName: string;
  playerToken?: string;
}

export function validatePurchaseItemInput(input: unknown): ValidationResult & { data?: PurchaseItemInput } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const data = input as Record<string, unknown>;
  const result: Partial<PurchaseItemInput> = {};

  // Validate gameId
  const gameIdResult = validateUUID(data.gameId, 'gameId', true);
  if (!gameIdResult.valid) return gameIdResult;
  result.gameId = gameIdResult.sanitized?.gameId as string;

  // Validate playerNumber
  const playerNumberResult = validatePositiveInteger(data.playerNumber, 'playerNumber', {
    required: true,
    min: 1,
    max: 1000,
  });
  if (!playerNumberResult.valid) return playerNumberResult;
  result.playerNumber = playerNumberResult.sanitized?.playerNumber as number;

  // Validate itemName
  const itemNameResult = validateString(data.itemName, 'itemName', {
    required: true,
    minLength: 1,
    maxLength: VALIDATION_LIMITS.ITEM_NAME_MAX,
    pattern: VALIDATION_LIMITS.ITEM_NAME_PATTERN,
    patternError: 'Item name contains invalid characters',
  });
  if (!itemNameResult.valid) return itemNameResult;
  result.itemName = itemNameResult.sanitized?.itemName as string;

  // Validate playerToken (optional)
  if (data.playerToken !== undefined && data.playerToken !== null && data.playerToken !== '') {
    const playerTokenResult = validateString(data.playerToken, 'playerToken', {
      required: false,
      minLength: VALIDATION_LIMITS.PLAYER_TOKEN_LENGTH,
      maxLength: VALIDATION_LIMITS.PLAYER_TOKEN_LENGTH,
      pattern: VALIDATION_LIMITS.PLAYER_TOKEN_PATTERN,
      patternError: 'Invalid player token format',
    });
    if (!playerTokenResult.valid) return playerTokenResult;
    result.playerToken = playerTokenResult.sanitized?.playerToken as string;
  }

  return { valid: true, data: result as PurchaseItemInput };
}

/**
 * Generate a cryptographically secure join code
 */
export function generateSecureJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing characters like 0, O, 1, I
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

/**
 * Generate a cryptographically secure player token
 */
export function generateSecurePlayerToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(randomBytes[i] % chars.length);
  }
  return token;
}
