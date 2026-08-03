EXPORT_COLUMNS = [
    "member_name", "email", "Care_Email", "contact_number",
    "Alternate_Contact", "Transaction_Date", "transaction_amount",
    "transaction_id", "passing_year", "course",
]
POLICY_COLUMN = "Policy (New/Renewal)"

ALIASES = {
    "member_name": ["member name", "member_name", "full name", "customer name", "student name", "name"],
    "email": ["email", "email id", "email address", "personal email"],
    "Care_Email": ["care email", "care_email", "care email id", "care email address"],
    "contact_number": ["contact number", "contact_number", "contact no", "mobile number", "mobile no", "phone number"],
    "Alternate_Contact": ["alternate contact", "alternate_contact", "alternate number", "alternate mobile", "secondary contact"],
    "Transaction_Date": [
        "transaction date", "transaction_date", "payment date", "txn date",
        "date of transaction", "policy start date", "policy date",
        "enrolment date", "enrollment date", "created date", "created at",
    ],
    "transaction_amount": [
        "transaction amount", "transaction_amount", "payment amount",
        "paid amount", "txn amount", "amount paid",
    ],
    "transaction_id": ["transaction id", "transaction_id", "txn id", "payment id", "reference id", "utr", "receipt number"],
    POLICY_COLUMN: ["policy new renewal", "policy (new renewal)", "new renewal", "new/renewal", "policy status", "new or renewal"],
    "passing_year": ["passing year", "passing_year", "year of passing", "graduation year", "passout year", "batch", "batch year"],
    "course": ["course", "course name", "program", "programme", "program name"],
}

EXTRA = {
    "dob": ["dob", "date of birth", "birth date"],
    "age": ["age", "member age"],
    "gender": ["gender", "sex"],
    "city": ["city", "town"],
    "state": ["state", "province"],
    "country": ["country", "nation"],
    "pincode": ["pincode", "pin code", "postal code", "zip code"],
    "sum_insured": ["sum insured", "sum_insured", "sum assured", "coverage amount", "cover amount"],
    "insurer": ["insurer", "insurance company", "carrier"],
    "plan_name": [
        "plan name", "plan_name", "insurance plan", "product name",
        "policy plan", "policy product",
    ],
    "policy_type": ["policy type", "policy_type", "insurance type"],
    "policy_name": ["policy name", "policy_name"],
    "pay_mode": ["pay mode", "pay_mode", "payment mode"],
    "nominee_relationship": [
        "nominee relationship", "nominee_relationship", "relationship with nominee",
        "nominee relation", "nominee_relation", "relation with nominee",
    ],
}
