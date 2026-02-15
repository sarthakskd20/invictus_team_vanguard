# Slide 1: Problem Understanding & Approach

## 1. Brief Summary of the Problem
*   **Manual & Error-Prone:** Reliance on disjointed Excel sheets leads to human error and data mismatch.
*   **Inventory Visibility:** No real-time view of stock levels, causing unexpected shortages.
*   **Reactive Procurement:** Orders are placed only after stock runs out, causing production downtime.

## 2. Key Challenges Identified
*   **Data Integrity:** Preventing "negative stock" during rapid production cycles.
*   **Concurrency Control:** Handling simultaneous updates from multiple users without conflicts.
*   **Auditability:** Tracing who changed what and when (implementation of `component_transactions`).

## 3. High-Level Solution Approach
*   **"Industrial Grade" Reliability:** Prioritizing database constraints (`CHECK >= 0`) and atomic transactions over flashy UI.
*   **Automated Triggers:** System auto-calculates shortages and flags procurement needs at 20% threshold.
*   **Seamless Integration:** Bulk Excel import/export to bridge the gap between legacy systems and the new web app.

## 4. Architecture & Flows (Visual Guides)

### Simple Architecture (Diagram Placeholder)
`[Frontend (React/Vite)]`  <-->  `[Backend (Node/Express)]`  <-->  `[Database (PostgreSQL)]`
*   *Note: Frontend handles UI, Backend handles logic & validation, DB ensures data safety.*

### JWT Authentication Flow (Diagram Placeholder)
1.  **Login:** User sends credentials -> Server validates.
2.  **Issue:** Server signs & sends **JWT Token**.
3.  **Store:** Client saves Token (LocalStorage/Cookie).
4.  **Access:** Client sends Token in Header (`Authorization: Bearer ...`) for every request.

### Excel Import/Export Flow (Diagram Placeholder)
*   **Import:** Upload File -> Parse Data -> Validate Existence -> **Atomic Bulk Update**.
*   **Export:** Request Report -> Query DB -> Format Data -> **Download .xlsx File**.
