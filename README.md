# Dominant Assurance Contract

This contract will help raise funds safely and ensure that if the specified amount is not collected at the right time, everyone will receive their funds back together with the bonus.

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

- **Build:** `npx blueprint build`

- **Test:** `npx blueprint test` 

- **Deploy or run another script:** `npx blueprint run`

## Fees

Commissions are calculated for a maximum of 500 users. If it is necessary to increase this number, then it is necessary to recalculate the commissions again

## Failed test

Some tests may fail if the computer on which they are running processes transactions slowly. This is due to the fact that after a certain time, the storage fee is deducted from contract balance and the balance does not coincide with the calculations.