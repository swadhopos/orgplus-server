const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const DeathRegister = require('../models/DeathRegister');
const MarriageCertificate = require('../models/MarriageCertificate');
const MarriageNOC = require('../models/MarriageNOC');
const Member = require('../models/Member');
const Organization = require('../models/Organization');
const Joi = require('joi');

/**
 * Validates the verification request payload
 */
const verifySchema = Joi.object({
    certId: Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid');
        }
        return value;
    }).required(),
    certificateNumber: Joi.string().required(),
    dateOfBirth: Joi.string().isoDate().required()
});

/**
 * @desc    Verify a certificate by ID or Number and holder's Date of Birth
 * @route   POST /api/public/verify-certificate
 * @access  Public
 */
const verifyCertificate = expressAsyncHandler(async (req, res) => {
    // 1. Input Validation
    const { error, value } = verifySchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Invalid Certificate Details'
            }
        });
    }

    const { certId, certificateNumber, dateOfBirth } = value;
    const searchDateStr = new Date(dateOfBirth).toISOString().split('T')[0];

    let foundCert = null;
    let memberIdToCheck = null;
    let certType = '';
    let issueDate = null;
    let memberName = '';
    let orgId = null;

    // Helper to perform lookup
    const findAcrossCollections = async (searchCriteria) => {
        // Try DeathRegister
        let cert = await DeathRegister.findOne(searchCriteria);
        if (cert && cert.status === 'verified') {
            return { 
                cert, 
                type: 'Death Certificate', 
                memberId: cert.memberId, 
                issue: cert.verifiedAt || cert.createdAt, 
                name: cert.memberFullName, 
                org: cert.organizationId,
                number: cert.certificateNumber 
            };
        }

        // Try Marriage Certificate
        cert = await MarriageCertificate.findOne(searchCriteria);
        if (cert && cert.status === 'issued') {
            return { 
                cert, 
                type: 'Marriage Certificate', 
                memberId: cert.spouseAId, 
                issue: cert.issuedAt || cert.createdAt, 
                name: cert.spouseAFullName, 
                org: cert.organizationId,
                number: cert.certificateNumber 
            };
        }

        // Try Marriage NOC
        cert = await MarriageNOC.findOne(searchCriteria);
        if (cert && cert.status === 'issued') {
            return { 
                cert, 
                type: 'Marriage NOC', 
                memberId: cert.memberId, 
                issue: cert.issueDate || cert.createdAt, 
                name: cert.memberFullName, 
                org: cert.organizationId,
                number: cert.certificateNumber 
            };
        }

        return null;
    };

    const searchCriteria = { _id: certId };
    const result = await findAcrossCollections(searchCriteria);

    if (result) {
        foundCert = result.cert;
        // Strict match for Certificate Number
        if (foundCert.certificateNumber !== certificateNumber) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid Certificate Details'
                }
            });
        }
        memberIdToCheck = result.memberId;
        certType = result.type;
        issueDate = result.issue;
        memberName = result.name;
        orgId = result.org;
    }

    // 5. If completely absent, return generic error
    if (!foundCert || !memberIdToCheck) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Invalid Certificate Details'
            }
        });
    }

    // 6. Verify Member's Date of Birth
    const member = await Member.findById(memberIdToCheck);
    if (!member || !member.dateOfBirth) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Invalid Certificate Details'
            }
        });
    }

    const memberDobStr = new Date(member.dateOfBirth).toISOString().split('T')[0];
    
    // Strict comparison
    if (memberDobStr !== searchDateStr) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Invalid Certificate Details'
            }
        });
    }

    // 7. Success! Fetch Org Name and return minimal data
    const org = await Organization.findById(orgId).select('name');
    
    return res.status(200).json({
        success: true,
        data: {
            certificate: {
                type: certType,
                certificateNumber: result.number,
                memberName: memberName,
                issueDate: issueDate,
                organizationName: org ? org.name : 'Verified Organization'
            }
        }
    });
});

module.exports = {
    verifyCertificate
};
