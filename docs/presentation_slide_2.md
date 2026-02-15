# Slide 2: ER Diagram & Database Schema

## 1. Key Database Tables
*   **`components`**: Master inventory. **Constraint**: `CHECK (current_stock >= 0)`.
*   **`pcb_types`**: Product definitions (e.g., STM32 Board).
*   **`pcb_components_mapping`**: Link table (Many-to-Many) defining Bill of Materials (BOM).
*   **`component_transactions` (Audit Trail)**: Immutable log of *every* stock change (Add/Deduct).
*   **`procurement_triggers`**: Auto-generated alerts for < 20% stock.

## 2. Table Relationships
*   **PCB <-> Components**: Many-to-Many via `pcb_components_mapping`.
    *   *One PCB has many components; One component is used in many PCBs.*
*   **Components -> Transactions**: One-to-Many.
    *   *One component has extensive history.*
*   **Production -> Transactions**: One-to-Many.
    *   *One production run creates multiple transaction records.*

## 3. Stock Deduction Logic (The "Industrial Grade" Flow)
1.  **Start Transaction**: open atomic wrapper.
2.  **Row Locking**: `SELECT ... FOR UPDATE` locks specific component rows.
3.  **Validation**: `If (stock - required < 0) -> ROLLBACK`.
4.  **Deduct**: Update stock levels.
5.  **Audit Log**: Insert immutable record into `component_transactions`.
6.  **Trigger Procurement**: If `new_stock < 20%`, auto-insert alert.
7.  **Commit**: Save all changes simultaneously.
