-- CreateEnum
CREATE TYPE "UploadCategory" AS ENUM ('Profile', 'Document', 'Prescription');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supportStatus" TEXT NOT NULL DEFAULT 'Open',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactNumber" TEXT NOT NULL,
    "emergencyContactRelationship" TEXT,
    "bloodGroup" TEXT NOT NULL,
    "fathersName" TEXT,
    "mothersName" TEXT,
    "nationality" TEXT,
    "maritalStatus" TEXT,
    "religion" TEXT,

    CONSTRAINT "CitizenProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityInfo" (
    "id" TEXT NOT NULL,
    "citizenProfileId" TEXT NOT NULL,
    "nid" TEXT,
    "nidNameBangla" TEXT,
    "nidFathersNameBangla" TEXT,
    "nidMothersNameBangla" TEXT,
    "nidStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "passport" TEXT,
    "passportType" TEXT,
    "passportIssueDate" TEXT,
    "passportExpiryDate" TEXT,
    "passportIssuePlace" TEXT,
    "passportStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "drivingLicense" TEXT,
    "drivingLicenseType" TEXT,
    "drivingLicenseVehicleCategories" TEXT,
    "drivingLicenseIssueDate" TEXT,
    "drivingLicenseExpiryDate" TEXT,
    "drivingLicenseStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "tradeLicense" TEXT,
    "tradeLicenseBusinessName" TEXT,
    "tradeLicenseBusinessType" TEXT,
    "tradeLicenseIssueAuthority" TEXT,
    "tradeLicenseFiscalYear" TEXT,
    "tradeLicenseStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "tin" TEXT,
    "tinCircleZone" TEXT,
    "tinAssessmentStatus" TEXT,
    "tinStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "landRecord" TEXT,
    "landRecordDaagNumber" TEXT,
    "landRecordMouzaThana" TEXT,
    "landRecordDistrict" TEXT,
    "landRecordStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "familyCard" TEXT,
    "familyCardMembersCount" TEXT,
    "familyCardStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "farmerCard" TEXT,
    "farmerCardType" TEXT,
    "farmerCardStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "status" TEXT NOT NULL DEFAULT 'Pending Review',

    CONSTRAINT "IdentityInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationInfo" (
    "id" TEXT NOT NULL,
    "citizenProfileId" TEXT NOT NULL,
    "sscRoll" TEXT,
    "sscReg" TEXT,
    "sscGpa" DOUBLE PRECISION,
    "sscGroup" TEXT,
    "sscBoard" TEXT,
    "sscPassingYear" INTEGER,
    "sscInstitution" TEXT,
    "sscStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "hscRoll" TEXT,
    "hscReg" TEXT,
    "hscGpa" DOUBLE PRECISION,
    "hscGroup" TEXT,
    "hscBoard" TEXT,
    "hscPassingYear" INTEGER,
    "hscInstitution" TEXT,
    "hscStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "university" TEXT,
    "degree" TEXT,
    "universityDepartment" TEXT,
    "universityStudentId" TEXT,
    "cgpa" DOUBLE PRECISION,
    "universitySemester" TEXT,
    "graduationYear" INTEGER,
    "universityEnrollmentYear" INTEGER,
    "universityStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "status" TEXT NOT NULL DEFAULT 'Pending Review',

    CONSTRAINT "EducationInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInfo" (
    "id" TEXT NOT NULL,
    "citizenProfileId" TEXT NOT NULL,
    "occupation" TEXT,
    "employmentStatus" TEXT,
    "companyName" TEXT,
    "workExperience" TEXT,
    "officeAddressEmail" TEXT,
    "occupationStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "monthlyIncome" DOUBLE PRECISION,
    "netTakeHomePay" DOUBLE PRECISION,
    "primaryIncomeSource" TEXT,
    "secondaryIncome" TEXT,
    "preferredPayoutMethod" TEXT,
    "incomeStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "incomeVerificationBadge" TEXT NOT NULL DEFAULT 'Self-Declared',
    "tin" TEXT,
    "taxZoneCircle" TEXT,
    "taxRegistrationStatus" TEXT,
    "taxpayerAssessmentCategory" TEXT,
    "taxComplianceStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "taxClearanceStatus" TEXT,
    "lastReturnSubmissionDate" TEXT,
    "taxYearOfLastReturn" TEXT,
    "acknowledgmentReceiptNumber" TEXT,
    "totalTaxPaid" DOUBLE PRECISION,
    "taxClearanceStatusBadge" TEXT NOT NULL DEFAULT 'Pending Review',
    "bankAccountNumber" TEXT,
    "bankNameBranch" TEXT,
    "routingNumber" TEXT,
    "mfsWallet" TEXT,
    "wealthStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "status" TEXT NOT NULL DEFAULT 'Pending Review',

    CONSTRAINT "FinancialInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "citizenProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Pending Review',

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestedData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "expiryTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL,
    "duplicateType" TEXT NOT NULL,
    "duplicateValue" TEXT NOT NULL,
    "involvedUserIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalInfo" (
    "id" TEXT NOT NULL,
    "citizenProfileId" TEXT NOT NULL,
    "bloodType" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "medicalHistory" TEXT,
    "immunizationStatus" TEXT,
    "insuranceProvider" TEXT,
    "insurancePolicyNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending Review',

    CONSTRAINT "MedicalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalVisitLog" (
    "id" TEXT NOT NULL,
    "medicalInfoId" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "prescriptionPic" TEXT,
    "reason" TEXT,
    "prescriptionPdf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalVisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeInfo" (
    "id" TEXT NOT NULL,
    "citizenProfileId" TEXT NOT NULL,
    "hasCriminalRecord" BOOLEAN NOT NULL DEFAULT false,
    "pendingCharges" TEXT,
    "recordDetails" TEXT,
    "clearanceCertificateNumber" TEXT,
    "clearanceStatus" TEXT NOT NULL DEFAULT 'Pending Review',
    "status" TEXT NOT NULL DEFAULT 'Pending Review',

    CONSTRAINT "CrimeInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineLog" (
    "id" TEXT NOT NULL,
    "crimeInfoId" TEXT NOT NULL,
    "fineDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fineReason" TEXT NOT NULL,
    "fineAmount" DOUBLE PRECISION,
    "isCleared" BOOLEAN NOT NULL DEFAULT false,
    "clearanceDate" TIMESTAMP(3),
    "clearanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeLog" (
    "id" TEXT NOT NULL,
    "crimeInfoId" TEXT NOT NULL,
    "offense" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "crimeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "category" "UploadCategory" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenProfile_userId_key" ON "CitizenProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenProfile_citizenId_key" ON "CitizenProfile"("citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_citizenProfileId_key" ON "IdentityInfo"("citizenProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_nid_key" ON "IdentityInfo"("nid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_passport_key" ON "IdentityInfo"("passport");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_drivingLicense_key" ON "IdentityInfo"("drivingLicense");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_tradeLicense_key" ON "IdentityInfo"("tradeLicense");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_tin_key" ON "IdentityInfo"("tin");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_familyCard_key" ON "IdentityInfo"("familyCard");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInfo_farmerCard_key" ON "IdentityInfo"("farmerCard");

-- CreateIndex
CREATE UNIQUE INDEX "EducationInfo_citizenProfileId_key" ON "EducationInfo"("citizenProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInfo_citizenProfileId_key" ON "FinancialInfo"("citizenProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInfo_tin_key" ON "FinancialInfo"("tin");

-- CreateIndex
CREATE INDEX "Document_citizenProfileId_idx" ON "Document"("citizenProfileId");

-- CreateIndex
CREATE INDEX "ConsentRequest_targetId_status_idx" ON "ConsentRequest"("targetId", "status");

-- CreateIndex
CREATE INDEX "ConsentRequest_requesterId_idx" ON "ConsentRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ConsentRequest_status_expiryTime_idx" ON "ConsentRequest"("status", "expiryTime");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "FraudAlert_status_idx" ON "FraudAlert"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalInfo_citizenProfileId_key" ON "MedicalInfo"("citizenProfileId");

-- CreateIndex
CREATE INDEX "HospitalVisitLog_medicalInfoId_createdAt_idx" ON "HospitalVisitLog"("medicalInfoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeInfo_citizenProfileId_key" ON "CrimeInfo"("citizenProfileId");

-- CreateIndex
CREATE INDEX "FineLog_crimeInfoId_idx" ON "FineLog"("crimeInfoId");

-- CreateIndex
CREATE INDEX "FineLog_isCleared_idx" ON "FineLog"("isCleared");

-- CreateIndex
CREATE INDEX "CrimeLog_crimeInfoId_idx" ON "CrimeLog"("crimeInfoId");

-- CreateIndex
CREATE INDEX "UploadedFile_ownerId_idx" ON "UploadedFile"("ownerId");

-- AddForeignKey
ALTER TABLE "CitizenProfile" ADD CONSTRAINT "CitizenProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityInfo" ADD CONSTRAINT "IdentityInfo_citizenProfileId_fkey" FOREIGN KEY ("citizenProfileId") REFERENCES "CitizenProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationInfo" ADD CONSTRAINT "EducationInfo_citizenProfileId_fkey" FOREIGN KEY ("citizenProfileId") REFERENCES "CitizenProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInfo" ADD CONSTRAINT "FinancialInfo_citizenProfileId_fkey" FOREIGN KEY ("citizenProfileId") REFERENCES "CitizenProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_citizenProfileId_fkey" FOREIGN KEY ("citizenProfileId") REFERENCES "CitizenProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalInfo" ADD CONSTRAINT "MedicalInfo_citizenProfileId_fkey" FOREIGN KEY ("citizenProfileId") REFERENCES "CitizenProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalVisitLog" ADD CONSTRAINT "HospitalVisitLog_medicalInfoId_fkey" FOREIGN KEY ("medicalInfoId") REFERENCES "MedicalInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeInfo" ADD CONSTRAINT "CrimeInfo_citizenProfileId_fkey" FOREIGN KEY ("citizenProfileId") REFERENCES "CitizenProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineLog" ADD CONSTRAINT "FineLog_crimeInfoId_fkey" FOREIGN KEY ("crimeInfoId") REFERENCES "CrimeInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeLog" ADD CONSTRAINT "CrimeLog_crimeInfoId_fkey" FOREIGN KEY ("crimeInfoId") REFERENCES "CrimeInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
