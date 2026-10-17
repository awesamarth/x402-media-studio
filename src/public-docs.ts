export const openapi = {
  "openapi": "3.1.0",
  "info": {
    "title": "X402 Media Studio",
    "version": "0.1.0",
    "description": "Read /llms.txt for the complete ordered workflow, constraints and PayBox integration. Quotes are authoritative; paid price is 10000 atomic USDC per billable operation on Base; quotes contain the total."
  },
  "servers": [
    {
      "url": "https://x402-media-studio.awesamarth.dev"
    }
  ],
  "components": {
    "securitySchemes": {
      "RequestHandle": {
        "type": "apiKey",
        "in": "header",
        "name": "X-Request-Handle",
        "description": "Temporary private bearer handle returned by POST /requests; never embed in URL or payment body"
      }
    },
    "schemas": {
      "SubtitleOptions": {
        "type": "object",
        "properties": {
          "format": {
            "enum": [
              "srt",
              "vtt"
            ]
          },
          "overlap": {
            "enum": [
              "error",
              "trim",
              "preserve"
            ]
          },
          "sort": {
            "type": "boolean"
          },
          "maxChars": {
            "type": "integer",
            "minimum": 10,
            "maximum": 100
          },
          "maxLines": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          }
        }
      },
      "Step": {
        "oneOf": [
          {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "transcribe"
              },
              "language": {
                "enum": [
                  "en",
                  "auto"
                ],
                "default": "en"
              }
            },
            "example": {
              "type": "transcribe",
              "language": "en"
            }
          },
          {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "localize"
              },
              "from": {
                "const": "en",
                "default": "en"
              },
              "to": {
                "const": "es",
                "default": "es"
              },
              "text": {
                "type": "string",
                "maxLength": 100000
              },
              "options": {
                "$ref": "#/components/schemas/SubtitleOptions"
              }
            },
            "example": {
              "type": "localize",
              "from": "en",
              "to": "es"
            }
          },
          {
            "type": "object",
            "required": [
              "type",
              "start",
              "duration"
            ],
            "properties": {
              "type": {
                "const": "clip"
              },
              "start": {
                "type": "number",
                "minimum": 0
              },
              "duration": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 600
              }
            },
            "example": {
              "type": "clip",
              "start": 0,
              "duration": 5
            }
          },
          {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "frames"
              },
              "atSeconds": {
                "type": "array",
                "minItems": 1,
                "maxItems": 12,
                "items": {
                  "type": "number",
                  "minimum": 0
                }
              },
              "ocr": {
                "type": "boolean",
                "default": false
              }
            },
            "example": {
              "type": "frames",
              "atSeconds": [
                0,
                2
              ],
              "ocr": true
            }
          },
          {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "repair_subtitles"
              },
              "text": {
                "type": "string",
                "maxLength": 100000
              },
              "options": {
                "$ref": "#/components/schemas/SubtitleOptions"
              }
            },
            "example": {
              "type": "repair_subtitles",
              "options": {
                "format": "vtt",
                "overlap": "trim"
              }
            }
          },
          {
            "type": "object",
            "required": [
              "type",
              "targetBytes"
            ],
            "properties": {
              "type": {
                "const": "convert"
              },
              "targetBytes": {
                "type": "integer",
                "minimum": 100000,
                "maximum": 100000000
              }
            },
            "example": {
              "type": "convert",
              "targetBytes": 1000000
            }
          },
          {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "normalize"
              }
            },
            "example": {
              "type": "normalize"
            }
          }
        ]
      },
      "Workflow": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "steps"
        ],
        "oneOf": [
          {
            "required": [
              "assetId"
            ],
            "not": {
              "required": [
                "source"
              ]
            }
          },
          {
            "required": [
              "source"
            ],
            "not": {
              "required": [
                "assetId"
              ]
            }
          }
        ],
        "properties": {
          "assetId": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "source": {
            "type": "object",
            "required": [
              "url",
              "media"
            ],
            "additionalProperties": false,
            "properties": {
              "url": {
                "type": "string",
                "format": "uri",
                "maxLength": 2048
              },
              "media": {
                "enum": [
                  "audio",
                  "video"
                ]
              }
            }
          },
          "steps": {
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "items": {
              "$ref": "#/components/schemas/Step"
            }
          }
        }
      }
    }
  },
  "paths": {
    "/requests": {
      "post": {
        "summary": "Create private request; response includes requestHandle, expiry and limits",
        "operationId": "post__requests",
        "security": [],
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "requestId",
                    "requestHandle",
                    "expiresAt",
                    "upload",
                    "workflow",
                    "limits"
                  ],
                  "properties": {
                    "requestId": {
                      "type": "string"
                    },
                    "requestHandle": {
                      "type": "string",
                      "pattern": "^[a-f0-9]{64}$",
                      "description": "Private temporary bearer; do not publish or include in payment URL/body"
                    },
                    "expiresAt": {
                      "type": "string",
                      "format": "date-time"
                    },
                    "upload": {
                      "type": "object",
                      "properties": {
                        "url": {
                          "type": "string",
                          "format": "uri"
                        },
                        "method": {
                          "const": "POST"
                        },
                        "contentType": {
                          "const": "application/octet-stream"
                        },
                        "requiredHeader": {
                          "const": "X-Request-Handle"
                        },
                        "maxBytes": {
                          "const": 104857600
                        },
                        "body": {
                          "type": "string"
                        },
                        "responseAssetIdField": {
                          "const": "id"
                        },
                        "pageUrl": {
                          "type": "string",
                          "format": "uri",
                          "description": "Private upload-only capability link for user file picker; show as Markdown link, do not publish"
                        }
                      }
                    },
                    "workflow": {
                      "type": "object",
                      "properties": {
                        "url": {
                          "type": "string",
                          "format": "uri"
                        },
                        "bodyExample": {
                          "type": "object"
                        }
                      }
                    },
                    "limits": {
                      "type": "object"
                    },
                    "assetLookup": {
                      "type": "object",
                      "description": "GET /requests/current using original X-Request-Handle"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "maxProperties": 0
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "summary": "Live billing mode and installed capabilities",
        "operationId": "get__health",
        "security": [],
        "responses": {
          "200": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        }
      }
    },
    "/assets": {
      "post": {
        "summary": "Upload raw media bytes; returns asset id",
        "operationId": "post__assets",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "201": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/octet-stream": {
              "schema": {
                "type": "string",
                "format": "binary",
                "maxLength": 104857600
              }
            }
          }
        }
      }
    },
    "/assets/{assetId}": {
      "get": {
        "summary": "Inspect an owned asset",
        "operationId": "get__assets_assetId",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "200": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "parameters": [
          {
            "name": "assetId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/quotes": {
      "post": {
        "summary": "Quote uploaded asset or supported direct URL workflow; no execution or charge",
        "operationId": "post__quotes",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "201": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Workflow"
              }
            }
          }
        }
      }
    },
    "/imports": {
      "post": {
        "summary": "Quote direct URL workflow; returns quote id, not import id in paid mode",
        "operationId": "post__imports",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "201": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "url",
                  "media"
                ],
                "properties": {
                  "url": {
                    "type": "string",
                    "format": "uri",
                    "maxLength": 2048
                  },
                  "media": {
                    "enum": [
                      "audio",
                      "video"
                    ]
                  },
                  "steps": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 8,
                    "items": {
                      "$ref": "#/components/schemas/Step"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/quotes/{quoteId}": {
      "get": {
        "summary": "Get purchase status and jobId; safely resumes already-settled enqueue without new payment",
        "operationId": "get__quotes_quoteId",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "200": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "parameters": [
          {
            "name": "quoteId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/purchases/{quoteId}": {
      "post": {
        "summary": "x402 paid purchase; public unsigned probe returns 402",
        "operationId": "post__purchases_quoteId",
        "security": [],
        "responses": {
          "200": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          },
          "402": {
            "description": "Payment required; PAYMENT-REQUIRED header contains base64 x402 v2 challenge"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "idempotencyKey": {
                    "type": "string",
                    "minLength": 8,
                    "maxLength": 100,
                    "pattern": "^[a-zA-Z0-9_-]+$"
                  }
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "quoteId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "PAYMENT-SIGNATURE",
            "in": "header",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "Provided by x402 payment client after user approval; never fabricate"
          }
        ]
      }
    },
    "/jobs/{jobId}": {
      "get": {
        "summary": "Poll job status; succeeded artifacts include filename, mimeType, bytes, downloadUrl, downloadExpiresAt and authenticated downloadPath",
        "operationId": "get__jobs_jobId",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "200": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          }
        },
        "parameters": [
          {
            "name": "jobId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/jobs/{jobId}/artifacts/{name}": {
      "get": {
        "summary": "Download owned succeeded-job artifact; optional inline=base64 up to 48 KiB",
        "operationId": "get__jobs_jobId_artifacts_name",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "200": {
            "description": "Success"
          },
          "400": {
            "description": "Invalid input"
          },
          "401": {
            "description": "Missing or expired private request handle"
          },
          "404": {
            "description": "Not found"
          },
          "410": {
            "description": "Files expired"
          }
        },
        "parameters": [
          {
            "name": "jobId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "inline",
            "in": "query",
            "schema": {
              "const": "base64"
            }
          }
        ]
      }
    },
    "/downloads/{jobId}/{name}": {
      "get": {
        "operationId": "downloadArtifact",
        "summary": "Download exactly one artifact using its short-lived capability URL from owned job status; no private handle header needed",
        "security": [],
        "parameters": [
          {
            "name": "jobId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "expires",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Binary artifact with filename, MIME type and private/no-store headers"
          },
          "403": {
            "description": "Invalid, modified or expired capability"
          },
          "404": {
            "description": "Artifact unavailable"
          },
          "410": {
            "description": "Job files expired"
          }
        }
      }
    },
    "/requests/current": {
      "get": {
        "operationId": "getRequestAsset",
        "summary": "Read owned upload status and uploaded assetId for same-request workflow continuation",
        "security": [
          {
            "RequestHandle": []
          }
        ],
        "responses": {
          "200": {
            "description": "uploadStatus, uploadsUsed, expiresAt and assetId/asset when ready"
          },
          "401": {
            "description": "Invalid request handle"
          }
        }
      }
    },
    "/upload": {
      "get": {
        "operationId": "uploadPage",
        "summary": "User-facing file chooser; open the private upload.pageUrl returned by POST /requests",
        "security": [],
        "responses": {
          "200": {
            "description": "Static HTML upload page; upload-only capability is kept in URL fragment and removed from address bar"
          }
        }
      }
    }
  }
};
export const guide = "# X402 Media Studio: agent workflow\n\nBase URL: https://x402-media-studio.awesamarth.dev\nOpenAPI: /openapi.json | Human guide: /docs | Capabilities: GET /health\n\n## Complete flow\n1. POST /requests with {}. Save response.requestHandle privately. No signup or developer API key. Each request permits one upload and four quotes, starting with one-hour access; admission is bounded (five requests/minute/IP, 64 active requests).\n2. Recommended chat input: present response.upload.pageUrl as a clickable Upload your video link. User opens the page, chooses their video/audio (100 MiB maximum), watches progress and returns to chat saying Uploaded. The page does not charge or process. Keep the original requestHandle internally. GET /requests/current with X-Request-Handle, or plugin get_request_asset, until uploadStatus is ready; use its assetId with /quotes or quote_workflow on the SAME request. The upload link is upload-only, expires with the original request, and cannot list/read files or quote/pay. No new connector is needed. This is a browser file picker flow, not automatic transport of a ChatGPT attachment. Alternative direct upload: upload actual bytes with POST /assets, Content-Type: application/octet-stream, X-Request-Handle: <handle>; response.id is assetId. Maximum 100 MiB, 30 minutes, 4K, eight streams. An agent needs file bytes and an outbound HTTP upload tool; PayBox does not automatically forward ChatGPT attachments. Alternatively POST /imports with {\"url\":\"https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav\",\"media\":\"audio\",\"steps\":[{\"type\":\"transcribe\",\"language\":\"en\"}]} and the same handle. In paid mode /imports returns a QUOTE id and does not download before purchase. Or provide source:{url,media} instead of assetId to /quotes. Only direct HTTPS media on raw.githubusercontent.com and media.w3.org is supported; extensions wav/mp3/m4a/mp4/webm/flac/ogg/aac/mov/mkv. No arbitrary URLs, redirects, cookies, YouTube or platform extraction.\n3. For uploads POST /quotes with {\"assetId\":\"<uploaded id>\",\"steps\":[{\"type\":\"transcribe\",\"language\":\"en\"},{\"type\":\"localize\",\"from\":\"en\",\"to\":\"es\"}]} and X-Request-Handle. Keep quote.id, amountAtomic and expiresAt. Quotes expire after four minutes. Ordered steps chain outputs; one to eight steps. Quotes and inspection do not charge or execute media processing.\n4. Purchase via PayBox use_service using a real credential_id from list_credentials, url = BASE + /purchases/ + quote.id, method POST, body {\"idempotencyKey\":\"stable-unique-key-123\"}. Do not include requestHandle in this payment URL/body or headers. Public GET or empty/unsigned POST to that purchase URL returns an x402 402 challenge. PayBox's unpaid probe omits body; paid re-fetch includes body. PayBox obtains user approval and supplies PAYMENT-SIGNATURE. The tariff is 0.01 USDC (10000 atomic) per billable workflow step, summed with integer arithmetic. A frames step including OCR is one operation; transcription SRT/VTT/JSON files together are one operation. Clipping is free for an owner-scoped server-verified YouTube asset; clip-only verified YouTube workflows quote zero and start through authenticated POST /workflows without x402. Mixed workflows exclude those clip steps and charge 0.01 USDC for each remaining operation. Upload, quote, status and download are free. Already-issued quote totals remain unchanged. Uploaded filenames and arbitrary client provenance do not establish the exemption; source URLs pass the existing server host/URL validation and stay bound to the quote. A validated YouTube source URL establishes the clipping tariff at quote time without download or prior ingestion. For billable workflows payment is on Base mainnet eip155:8453; USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Facilitator https://facilitator.xpay.sh. Always use the quote amount: future prices are backend-driven. A real paid workflow has been verified; each new payment still requires its own successful PayBox outcome.\n5. If PayBox returns pending, poll get_request with its request_id until terminal. Never repeat the purchase to poll or recover an uncertain payment. Tool success alone is not payment success. Once successful, GET /quotes/<quoteId> with X-Request-Handle to retrieve paymentStatus, fulfillmentStatus when applicable, jobId and settlementReceipt (success, transaction, network and payer when valid). Payment state stays settled while fulfillment follows queued/running/succeeded/failed/expired. The receipt is saved facilitator output, not a new blockchain lookup. awaiting_capacity means poll this same quote; already-settled enqueue can safely resume without another payment.\n6. GET /jobs/<jobId> with the same handle until succeeded or failed. Jobs have bounded retry and idempotency. On succeeded, each artifact includes filename, mimeType, bytes, downloadUrl and downloadExpiresAt. Present downloadUrl as a clickable Markdown link labeled with filename; browsers need no custom headers. These URLs grant read-only access to exactly one artifact for at most 15 minutes, never beyond job file expiry. Keep capability links private. Refresh links by reading the owned job again while its files remain available. The original artifact.downloadPath still supports X-Request-Handle. For small text, append ?inline=base64 (48 KiB maximum), decode response.data. Large media can be downloaded using the supplied short-lived downloadUrl. Never invent download URLs or put request handles in URLs.\n7. Media files expire one hour after job completion or final failure, unused uploads one hour after upload. Read expiresAt. Pending jobs have no completion expiry yet; metadata/tombstones remain for replay safety. Expired artifact reads return 410.\n\n## Seven operations: exact examples and restrictions\n- transcribe: {\"type\": \"transcribe\", \"language\": \"en\"}\n- localize: {\"type\": \"localize\", \"from\": \"en\", \"to\": \"es\"}\n- clip: {\"type\": \"clip\", \"start\": 0, \"duration\": 5}\n- frames: {\"type\": \"frames\", \"atSeconds\": [0, 2], \"ocr\": true}\n- repair_subtitles: {\"type\": \"repair_subtitles\", \"options\": {\"format\": \"vtt\", \"overlap\": \"trim\"}}\n- convert: {\"type\": \"convert\", \"targetBytes\": 1000000}\n- normalize: {\"type\": \"normalize\"}\nTranscription supports en or auto; English verified; local small Whisper, maximum five minutes (clip first for longer uploads). Localization supports ONLY en -> es using local Argos; use from/to, not targetLanguage. Localization and repair require preceding transcription/captions or explicit SRT/VTT text (maximum 100000 characters). Translation maximum 500 cues, 2000 characters/cue. Subtitle options: format srt/vtt, overlap error/trim/preserve, sort boolean, maxChars 10..100, maxLines 1..5. Clip start >=0, duration >0..600 and within source. Clip/normalize invalidate earlier captions; transcribe afterward. Frames requires video, 1..12 atSeconds within duration (default [0]); OCR uses installed English Tesseract. Convert requires targetBytes 100000..100000000, outputs H.264/AAC MP4 with a target-size budget; there is no selectable codec parameter. Normalize trims silence and normalizes loudness using fixed defaults; requires audio and outputs audio. FFmpeg, Whisper, Argos and OCR execute on the backend; check /health for availability. No hosted paid AI credentials assumed.\n\n## Runnable unpaid example (curl + jq; no funds moved)\n```sh\nBASE=https://x402-media-studio.awesamarth.dev\nSESSION=$(curl --fail-with-body -sS \"$BASE/requests\" -H 'Content-Type: application/json' -d '{}')\nHANDLE=$(printf '%s' \"$SESSION\" | jq -r .requestHandle)\nQUOTE=$(curl --fail-with-body -sS \"$BASE/imports\" -H \"X-Request-Handle: $HANDLE\" -H 'Content-Type: application/json' -d '{\"url\":\"https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav\",\"media\":\"audio\",\"steps\":[{\"type\":\"transcribe\",\"language\":\"en\"},{\"type\":\"localize\",\"from\":\"en\",\"to\":\"es\"}]}')\nQID=$(printf '%s' \"$QUOTE\" | jq -r .id)\nprintf '%s' \"$QUOTE\" | jq '{id,amountAtomic,expiresAt}'\n# Expected HTTP 402; this does not pay or enqueue a job.\ncurl -sS -D - \"$BASE/purchases/$QID\" -H 'Content-Type: application/json' -d '{\"idempotencyKey\":\"docs-example-unique-123\"}'\n```\nFor a local file replace the /imports call with raw upload, then /quotes:\n```sh\nASSET=$(curl --fail-with-body -sS \"$BASE/assets\" -H \"X-Request-Handle: $HANDLE\" -H 'Content-Type: application/octet-stream' --data-binary @input.mp4)\nAID=$(printf '%s' \"$ASSET\" | jq -r .id)\nQUOTE=$(jq -n --arg id \"$AID\" '{assetId:$id,steps:[{type:\"transcribe\",language:\"en\"}]}' | curl --fail-with-body -sS \"$BASE/quotes\" -H \"X-Request-Handle: $HANDLE\" -H 'Content-Type: application/json' --data-binary @-)\n```\nAfter a user-approved PayBox payment, continue using the original HANDLE and QID:\n```sh\nPURCHASE=$(curl --fail-with-body -sS \"$BASE/quotes/$QID\" -H \"X-Request-Handle: $HANDLE\")\nJOB=$(printf '%s' \"$PURCHASE\" | jq -r .jobId)\ncurl --fail-with-body -sS \"$BASE/jobs/$JOB\" -H \"X-Request-Handle: $HANDLE\"\n# Repeat job read until succeeded, then use an actual artifact.downloadPath:\n# curl --fail-with-body \"$BASE$DOWNLOAD_PATH\" -H \"X-Request-Handle: $HANDLE\" -o result.srt\n```\nInstalled PayBox plugin tools mirror create_request, get_request_asset, inspect_asset, import_url, quote_workflow, purchase_workflow, get_purchase, get_job and read_artifact. Discover actual plugin/tool identifiers and schemas; do not guess. The adapter provides a private browser upload link through create_request and polls it through get_request_asset. It does not automatically forward ChatGPT attachments. Raw upload by a capable agent and supported direct URLs remain alternatives. Developer portal proposal validation is unpaid and cannot establish settlement. Public documentation needs no handle; private assets, quotes and job status require the owning handle. Artifacts require either the owning handle on the original route or an issued short-lived single-file downloadUrl. Errors include 400 invalid input, 401 missing/expired handle, 404 inaccessible/missing object, 410 expired artifact, 429 admission, 503 unavailable import/provider. Keep handles private and never publish them in examples.\n";
const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
export const docsHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Media Studio API guide</title><style>body{max-width:960px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#172033}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6fa;padding:24px;border-radius:12px}a{color:#224dcc}</style><h1>Media Studio API guide</h1><p><a href="/openapi.json">OpenAPI contract</a> · <a href="/llms.txt">Agent instructions</a> · <a href="/health">Live capabilities</a></p><pre>${escape(guide)}</pre></html>`;
