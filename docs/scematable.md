# How to Create a Database Schema Table

This document provides a guide on how to understand and create a schema table for the UrbanPOS application. A database schema table is a crucial piece of documentation that visually represents the structure of your database, making it easier for developers to understand the data model at a glance.

## What is a Schema Table?

A schema table is a structured representation of a single data entity (like a `Product` or `Sale`). It typically includes the following columns:

-   **Field Name**: The name of the property (e.g., `name`, `price`).
-   **Data Type**: The type of data the field holds (e.g., `string`, `number`, `boolean`).
-   **Description**: A clear, human-readable explanation of what the field represents.
-   **Required**: Indicates whether the field is mandatory for every record (`Yes` or `No`).
-   **Constraints/Notes**: Any additional rules, such as format (`uri`, `date-time`), default values, or relationships to other entities.

## How to Generate a Schema Table for This Project

This project uses a centralized file, `docs/backend.json`, to define all data entities. This file is the "source of truth" for your database schema. You can use it to generate a schema table for any entity.

### Step-by-Step Guide:

1.  **Choose an Entity**: Open the `docs/backend.json` file. Look inside the `"entities"` object and choose the entity you want to document (e.g., `"Product"`).

2.  **Identify the Properties**: Inside the chosen entity block, find the `"properties"` object. Each key-value pair inside this object represents a field in your schema table.

3.  **Fill Out the Table Columns**: For each property, extract the following information:
    *   **Field Name**: This is the key of the property (e.g., `"name"`).
    *   **Data Type**: This is the value of the `"type"` field (e.g., `"string"`).
    *   **Description**: This is the value of the `"description"` field.
    *   **Required**: Check the `"required"` array at the bottom of the entity definition. If the field name is in this array, the value is "Yes"; otherwise, it's "No".
    *   **Constraints/Notes**: Look for additional fields like `"format"` (e.g., `"uri"` for an image URL) or any other relevant details in the description.

### Example: Generating the Schema Table for the `Product` Entity

Let's use the `Product` entity from `docs/backend.json` as an example.

**`Product` Entity from `backend.json`:**
```json
"Product": {
  "title": "Product",
  "type": "object",
  "description": "Represents a product sold in the store.",
  "properties": {
    "id": { "type": "string", "description": "..." },
    "name": { "type": "string", "description": "..." },
    "price": { "type": "number", "description": "..." },
    "imageUrl": { "type": "string", "format": "uri", "description": "..." },
    "categoryId": { "type": "string", "description": "..." },
    "stockQuantity": { "type": "number", "description": "..." }
  },
  "required": [ "id", "name", "price", "categoryId", "stockQuantity" ]
}
```

**Resulting Schema Table (in Markdown format):**

| Field Name      | Data Type | Description                                        | Required | Constraints / Notes                               |
| :-------------- | :-------- | :------------------------------------------------- | :------- | :------------------------------------------------ |
| `id`            | `string`  | Unique identifier for the product.                 | Yes      | Primary Key                                       |
| `name`          | `string`  | Name of the product.                               | Yes      |                                                   |
| `description`   | `string`  | Detailed description of the product.               | No       |                                                   |
| `sku`           | `string`  | Stock Keeping Unit for inventory tracking.         | No       |                                                   |
| `price`         | `number`  | Selling price of the product.                      | Yes      |                                                   |
| `cost`          | `number`  | Cost of the product.                               | No       |                                                   |
| `imageUrl`      | `string`  | URL of the product image.                          | No       | Must be a valid URI.                              |
| `categoryId`    | `string`  | Reference to a Category document.                  | Yes      | Foreign Key to `Category` collection.             |
| `stockQuantity` | `number`  | Number of units currently in stock.                | Yes      |                                                   |

By following this process for each entity in `backend.json`, you can create a complete and accurate set of schema tables for your SDP documentation.
