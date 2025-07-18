# Fish Batch API Documentation

## Overview
This API provides endpoints for managing fish batches in a blockchain-based supply chain system. The API supports the complete lifecycle of fish batches from catch to sale, including transfers between different types of organizations (Vessel Owners, Processors, Wholesalers, and Government).

## Base URL
```
/fabric/batches
```

## Authentication
All endpoints require proper authentication and organization-specific permissions as indicated in each endpoint description.

---

## Endpoints

### 1. Get All Fish Batches
Retrieves a list of all fish batches in the system.

- **URL:** `GET /fabric/batches/`
- **Auth Required:** Yes
- **Permissions:** Any authenticated user

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Array of fish batch objects

```json
[
  {
    "ID": "catch-1752872601137",
    "Location": "40.7128,-74.0060",
    "Owner": "VesselOwnerMSP/user1",
    "Quantity": 10,
    "Specie": "Atlantic Dolpine",
    "Status": "TRANSFERRING"
  },
  {
    "ID": "catch-1752876346971",
    "Location": "40.7128,-74.0060",
    "Owner": "VesselOwnerMSP/user1",
    "Quantity": 150,
    "Specie": "Atlantic Salmon",
    "Status": "CAUGHT"
  }
]
```

---

### 2. Get Fish Batch by ID
Retrieves the latest state of a specific fish batch by its catch ID.

- **URL:** `GET /fabric/batches/:catchId`
- **Auth Required:** Yes
- **Permissions:** Any authenticated user

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Fish batch object

```json
{
  "ID": "catch-1642567890123",
  "Location": "Pacific Ocean, 35.123N, 120.456W",
  "Quantity": 500,
  "Specie": "Tuna",
  "Status": "Processing",
  "Owner": "processor-1",
  "ProcessedQuantity": 450
}
```

- **Error Responses:**
  - **Code:** 400 Bad Request - Catch ID is required
  - **Code:** 404 Not Found - Fish batch not found
  - **Code:** 500 Internal Server Error - Failed to retrieve fish batch

---

### 3. Get Fish Batch History
Retrieves the complete transaction history of a fish batch.

- **URL:** `GET /fabric/batches/:catchId/history`
- **Auth Required:** Yes
- **Permissions:** Any authenticated user

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Array of historical transactions

```json
[
  {
    "txId": "3064cdd5d11ba1d21fa452d74a23dc6851d131c2370b3ed93ed99f3c8bc5daf2",
    "timestamp": {
      "seconds": 1752872748,
      "nanos": 575000000
    },
    "isDelete": false,
    "fishBatch": {
      "ID": "catch-1752872601137",
      "Location": "40.7128,-74.0060",
      "Specie": "Atlantic Dolpine",
      "Quantity": 10,
      "Owner": "VesselOwnerMSP/user1",
      "Status": "TRANSFERRING"
    }
  },
  {
    "txId": "c62616bd8fe74b67a0ec788f362f7c549a746f801380e70045643978f409e42b",
    "timestamp": {
      "seconds": 1752872601,
      "nanos": 140000000
    },
    "isDelete": false,
    "fishBatch": {
      "ID": "catch-1752872601137",
      "Location": "40.7128,-74.0060",
      "Specie": "Atlantic Dolpine",
      "Quantity": 10,
      "Owner": "VesselOwnerMSP/user1",
      "Status": "CAUGHT"
    }
  }
]
```

- **Error Responses:**
  - **Code:** 400 Bad Request - Catch ID is required
  - **Code:** 404 Not Found - Fish batch history not found
  - **Code:** 500 Internal Server Error - Failed to retrieve fish batch history

---

### 4. Create Fish Batch
Creates a new fish batch. Only Vessel Owners can perform this action.

- **URL:** `POST /fabric/batches/`
- **Auth Required:** Yes
- **Permissions:** Vessel Owner only

#### Request Body
```json
{
  "location": "40.7128,-74.0060",
  "quantity": 10,
  "specie": "Atlantic Salmon"
}
```

#### Request Parameters
- `location` (string, required): The location where the fish was caught (coordinates format: "latitude,longitude")
- `quantity` (number, required): The quantity of fish caught
- `specie` (string, required): The species of fish

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Created batch ID

```json
{
  "id": "catch-1752876346971"
}
```

- **Error Responses:**
  - **Code:** 400 Bad Request - Missing required fields: location, quantity, specie
  - **Code:** 403 Forbidden - Only Vessel Owners can create fish batches
  - **Code:** 409 Conflict - Batch already exists
  - **Code:** 500 Internal Server Error - Failed to create catch

---

### 5. Transfer to Processing
Transfers a fish batch to a processor. Only Vessel Owners can perform this action.

- **URL:** `POST /fabric/batches/:catchId/transfer/processing`
- **Auth Required:** Yes
- **Permissions:** Vessel Owner only (and must own the batch)

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Request Body
```json
{
  "processor": "processor-1"
}
```

#### Request Parameters
- `processor` (string, required): The ID of the processor to transfer the batch to

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - id and processor values are required
  - **Code:** 403 Forbidden - Only Vessel Owners can transfer fish batches / Only owner can transfer fish batches
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 409 Conflict - Batch is not in a transferable state
  - **Code:** 500 Internal Server Error - Failed to transfer catch to processing

---

### 6. Transfer to Wholesale
Transfers a fish batch to a wholesaler. Only Processors can perform this action.

- **URL:** `POST /fabric/batches/:catchId/transfer/wholesale`
- **Auth Required:** Yes
- **Permissions:** Processor only (and must own the batch)

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Request Body
```json
{
  "wholesaler": "wholesaler-1"
}
```

#### Request Parameters
- `wholesaler` (string, required): The ID of the wholesaler to transfer the batch to

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - catchId and wholesaler values are required / Batch is not ready to transfer to wholesale
  - **Code:** 403 Forbidden - Organization mismatch / Ownership verification failed
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 7. Accept to Processing
Accepts a fish batch transfer to processing. Only Processors can perform this action.

- **URL:** `POST /fabric/batches/:catchId/accept/processing`
- **Auth Required:** Yes
- **Permissions:** Processor only (must be the designated recipient)

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - Catch ID is required / Batch is not in transferring state
  - **Code:** 403 Forbidden - Organization mismatch / Ownership verification failed
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 8. Accept to Wholesale
Accepts a fish batch transfer to wholesale. Only Wholesalers can perform this action.

- **URL:** `POST /fabric/batches/:catchId/accept/wholesale`
- **Auth Required:** Yes
- **Permissions:** Wholesaler only (must be the designated recipient)

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - Catch ID is required / Batch is not transferring / Fish batch is not in transferring status
  - **Code:** 403 Forbidden - Organization mismatch / Fish batch is not transferred to you
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 9. Process Fish Batch
Processes a fish batch, updating its processed quantity. Only Processors can perform this action.

- **URL:** `PATCH /fabric/batches/:catchId/process`
- **Auth Required:** Yes
- **Permissions:** Processor only (and must own the batch)

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Request Body
```json
{
  "quantity": 100
}
```

#### Request Parameters
- `quantity` (number, required): The processed quantity (must be positive)

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Updated batch information

```json
{
  "ID": "catch-1752876346971",
  "Location": "40.7128,-74.0060",
  "Specie": "Atlantic Salmon",
  "Quantity": 100,
  "Owner": "ProcessorMSP/user1",
  "Status": "PROCESSED"
}
```

- **Error Responses:**
  - **Code:** 400 Bad Request - catchId and quantity are required / Quantity must be a positive number / Invalid quantity specified
  - **Code:** 403 Forbidden - Organization mismatch / You are not the owner of this batch
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 409 Conflict - Fish batch is not in the processing state
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 10. Sell Fish Batch
Sells a fish batch. Only Wholesalers can perform this action.

- **URL:** `POST /fabric/batches/:catchId/sell`
- **Auth Required:** Yes
- **Permissions:** Wholesaler only (and must own the batch)

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Sale confirmation

```json
{
  "ID": "catch-1752876346971",
  "Location": "40.7128,-74.0060",
  "Specie": "Atlantic Salmon",
  "Quantity": 100,
  "Owner": "WholesalerMSP/user1",
  "Status": "SOLD"
}
```

- **Error Responses:**
  - **Code:** 400 Bad Request - Batch ID is required / Fish batch is not in transferring status
  - **Code:** 403 Forbidden - Organization mismatch / Fish batch is not transferred to you
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

## Government Operations

### 11. Seize Fish Batch
Seizes a fish batch for regulatory purposes. Only Government can perform this action.

- **URL:** `POST /fabric/batches/:catchId/seize`
- **Auth Required:** Yes
- **Permissions:** Government only

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Request Body
```json
{
  "reason": "Violation of fishing regulations"
}
```

#### Request Parameters
- `reason` (string, required): The reason for seizing the batch

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - catchId and reason are required
  - **Code:** 403 Forbidden - Organization mismatch
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 12. Release Seized Fish Batch
Releases a previously seized fish batch. Only Government can perform this action.

- **URL:** `POST /fabric/batches/:catchId/release`
- **Auth Required:** Yes
- **Permissions:** Government only

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - Catch ID is required / Batch is not in seized status
  - **Code:** 403 Forbidden - Organization mismatch
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 13. Dispose Seized Fish Batch
Permanently disposes of a seized fish batch. Only Government can perform this action.

- **URL:** `POST /fabric/batches/:catchId/dispose`
- **Auth Required:** Yes
- **Permissions:** Government only

#### URL Parameters
- `catchId` (string, required): The unique identifier of the fish batch

#### Response
- **Success Response:**
  - **Code:** 204 No Content

- **Error Responses:**
  - **Code:** 400 Bad Request - Catch ID is required / Batch is not in seized status
  - **Code:** 403 Forbidden - Organization mismatch
  - **Code:** 404 Not Found - Batch does not exist
  - **Code:** 500 Internal Server Error - Unknown error occurred

---

### 14. Get All Seized Fish Batches
Retrieves all seized fish batches. Only Government can perform this action.

- **URL:** `GET /fabric/batches/seized`
- **Auth Required:** Yes
- **Permissions:** Government only

#### Response
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** Array of seized fish batch objects

```json
[
  {
    "ID": "catch-1642567890123",
    "Status": "Seized",
    "SeizedReason": "Violation of fishing regulations",
    "SeizedTimestamp": "2024-01-18T12:00:00Z",
    "OriginalOwner": "vessel-owner-1"
  }
]
```

- **Error Responses:**
  - **Code:** 404 Not Found - Could not retrieve seized assets

---

## Status Flow

The fish batch follows this typical status flow:

1. **Caught** → Created by Vessel Owner
2. **TransferringToProcessing** → Transferred by Vessel Owner to Processor
3. **Processing** → Accepted by Processor
4. **Processed** → Processed by Processor
5. **TransferringToWholesale** → Transferred by Processor to Wholesaler
6. **Wholesale** → Accepted by Wholesaler
7. **Sold** → Sold by Wholesaler

At any point, Government can:
- **Seize** the batch (Status: Seized)
- **Release** a seized batch (returns to previous status)
- **Dispose** a seized batch (Status: Disposed)

---

## Error Codes

The API uses standard HTTP status codes and returns detailed error messages:

- **200 OK** - Request successful
- **204 No Content** - Request successful, no content to return
- **400 Bad Request** - Invalid request parameters
- **403 Forbidden** - Insufficient permissions or organization mismatch
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict (e.g., batch already exists, invalid status)
- **500 Internal Server Error** - Server error

All error responses include a JSON object with an `error` field describing the issue:

```json
{
  "error": "Description of the error"
}
```