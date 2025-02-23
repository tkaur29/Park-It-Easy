import customerModel from "../models/customerModel";

import {
    getCurrentDateTime,
    verifyPayment,
    createRazorpayOrder,
    fetchDirectionForCustomer,
    findNearestVacantSpot,
    findPathToAllocatedPillar
  } from "../../util/util";
import organisationModel from "../models/organisationModel";
import salesTransactionModel from "../models/salesTransactionModel";
import parkingModel from "../models/parkingModel";

export const postNumberPlateEntry = async (req, res) => {
  try {
    const { licPlate, vehicleType, organizationUniqueDomainID } = req.body;

    // Find the organization using the unique ID
    const org = await organisationModel.findOne({ organizationUniqueDomainID: organizationUniqueDomainID });
    if (!org) {
      return res.status(404).json({
        status_code: 404,
        message: "Organization not found"
      });
    }

    let amount = vehicleType === "car" ? org.carPrice : org.motorPrice;


    // Create a new customer entry
    const newCustomer = new customerModel({
      vehicleType,
      vehicleNumber: licPlate,
      entryDateTime: new Date(), // Assuming getCurrentDateTime() returns a Date object
      organizationUniqueDomainID
    });

    // Save the new customer to the database
    await newCustomer.save();


    const paymentOrder = await createRazorpayOrder(newCustomer,amount || 100);

    return res.status(200).json({
      status_code: 200,
      data: paymentOrder, // Assuming createRazorpayOrder returns order details
      message: "Entry and payment order successfully created"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: 500,
      success: false,
      message: "Internal server error"
    });
  }
};




export const paymentVerificationAndDirectionAllotment = async (req, res) => {
  try {
    const { razorpay_signature, razorpay_order_id, razorpay_payment_id, customerID } = req.body;

    if (!verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({
        status_code: 400,
        message: "Payment verification failed"
      });
    }

    // Record the sales transaction
    const newTransaction = new salesTransactionModel({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerID,
      status: 'verified'
    });
    await newTransaction.save();

    const customerUpdate = await customerModel.findByIdAndUpdate(customerID, {
      $set: { isPaymentVerified: true },
      $push: { transactions: newTransaction._id } 
    }, { new: true }).populate('organisation');

    if (!customerUpdate) {
      return res.status(404).json({
        status_code: 404,
        message: "Customer not found"
      });
    }

    const organisation = customerUpdate.organisation;

    // Selected Seats here , to show and Feed which is feed
    let pillarDetails = await parkingModel.findOne({ organisation: organisation });

    if (!pillarDetails || !pillarDetails.pillars || !pillarDetails.entryGateNearestPillar) {
      return res.status(404).json({
        status_code: 404,
        message: "Parking layout details not found"
      });
    }

   const locationSpotted = findNearestVacantSpot(pillarDetails.pillars, pillarDetails.entryGateNearestPillar);

   // Calculate the directions to the allocated spot using pillar names
   const directionArray = findPathToAllocatedPillar(pillarDetails.pillars, pillarDetails.entryGateNearestPillar, locationSpotted);

   
    return res.status(200).json({
      status_code: 200,
      message: "Payment verified and direction allocated successfully",
      customer: customerUpdate,
      directionArray: directionArray,
      locationSpotted: locationSpotted
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status_code: 500,
      message: "Something went wrong"
    });
  }
};





export const vehicleSubmittedSucessfully = async (req, res) => {
    try {
        const { licPlate, vehicleType, organizationUniqueDomainID } = req.body;

        // Check if organization exists
        const organization = await organisationModel.findOne({ organizationUniqueDomainID });
        if (!organization) {
            return res.status(404).json({
                status_code: 404,
                message: "Organization not found"
            });
        }

        // Check if customer already exists (assuming license plate is unique identifier)
        let customer = await customerModel.findOne({ vehicleNumber: licPlate });
        if (customer) {
            // Update existing customer record if needed
            customer.entryDateTime = new Date();  // Update entry time on parking
            await customer.save();
        } else {
            // Create new customer if not found
            customer = new customerModel({
                vehicleType,
                vehicleNumber: licPlate,
                entryDateTime: new Date(), // Using JavaScript's Date object to get the current time
                organizationUniqueDomainID,
                organisation: organization._id  // Linking customer to the organization
            });

            // Save the new customer
            await customer.save();
        }

        // Return success response
        return res.status(200).json({
            status_code: 200,
            data: customer,
            message: "Vehicle submitted successfully"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status_code: 500,
            success: false,
            message: "An error occurred"
        });
    }
};


export const handleReallotment = async (req, res) => {
  try {
      const { licPlate, organizationUniqueDomainID, reason,pillarDetails ,oldPillarDetails} = req.body;

      const organization = await organisationModel.findOne({ organizationUniqueDomainID });
      if (!organization) {
          return res.status(404).json({
              status_code: 404,
              message: "Organization not found"
          });
      }

      const originalCustomer = await customerModel.findOne({ vehicleNumber: licPlate });
      if (!originalCustomer) {
          return res.status(404).json({
              status_code: 404,
              message: "Vehicle not found for reallotment"
          });
      }

      const reallotment = new Reallotment({
          vehicleNumber: licPlate,
          originalEntryDateTime: originalCustomer.entryDateTime,
          reallotmentDateTime: new Date(),
          reason,
          organizationUniqueDomainID,
          status: 'pending'
      });

      // Save the reallotment record
      await reallotment.save();


      const locationSpotted = findNearestVacantSpot(pillarDetails.pillars, oldPillarDetails);


      return res.status(200).json({
          status_code: 200,
          data: reallotment,
          message: "Reallotment initiated successfully",
          locationSpotted
      });

  } catch (error) {
      console.log(error);
      return res.status(500).json({
          status_code: 500,
          success: false,
          message: "An error occurred"
      });
  }
};

export const pinVerification = async (req, res) => {
  try {
      const { licPlate, pin, organizationUniqueDomainID } = req.body;

      // Check if organization exists
      const organization = await organisationModel.findOne({ organizationUniqueDomainID });
      if (!organization) {
          return res.status(404).json({
              status_code: 404,
              message: "Organization not found"
          });
      }

      // Find customer by license plate within the organization
      const customer = await customerModel.findOne({ vehicleNumber: licPlate, organizationUniqueDomainID });
      if (!customer) {
          return res.status(404).json({
              status_code: 404,
              message: "Vehicle not found"
          });
      }

      // Verify the pin
      if (customer.pin === pin) {
          return res.status(200).json({
              status_code: 200,
              data: '',
              message: "PIN verified successfully"
          });
      } else {
          return res.status(401).json({
              status_code: 401,
              message: "PIN verification failed"
          });
      }

  } catch (error) {
      console.log(error);
      return res.status(500).json({
          status_code: 500,
          success: false,
          message: "An error occurred"
      });
  }
};


export const pinFailureRequest = async (req, res) => {
  try {
      const { licPlate, organizationUniqueDomainID } = req.body;

      // Check if organization exists
      const organization = await organisationModel.findOne({ organizationUniqueDomainID });
      if (!organization) {
          return res.status(404).json({
              status_code: 404,
              message: "Organization not found"
          });
      }

      // Log the issue in the system
      const newIssue = new SystemIssue({
          vehicleNumber: licPlate,
          issueType: 'PIN Failure',
          description: 'Failed PIN verification attempt',
          organizationUniqueDomainID
      });

      await newIssue.save();

      // Optionally, send a notification to the admin panel here (implement based on your notification system)

      return res.status(200).json({
          status_code: 200,
          message: "Issue reported successfully"
      });

  } catch (error) {
      console.log(error);
      return res.status(500).json({
          status_code: 500,
          success: false,
          message: "An error occurred"
      });
  }
};



  