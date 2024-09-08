"use client";
import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { QRCodeCanvas } from "qrcode.react";

const Directions = () => {
  const [parked, setParked] = useState(false);
  const [link, setLink] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);

  const handleSetParked = () => {
    const sessionId = uuidv4(); // Unique session ID
    const newLink = `${window.location.origin}/qr/${sessionId}`; // Corrected string interpolation with backticks
    setParked(true);
    setLink(newLink);
  };

  const handleReallotment = () => {
    setParked(false);
    alert("Requesting Re-allotment...");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard!");
  };

  const handleShowQRCode = () => {
    setShowQRCode(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <div className="bg-black p-4 rounded-t-lg w-full max-w-sm text-white text-center">
        <h1 className="text-2xl font-bold">ParkItEasy</h1>
      </div>

      <div className="bg-white w-full max-w-sm shadow-lg rounded-b-lg p-4">
        <h2 className="text-xl font-semibold mb-4 text-center">Directions</h2>
        <div className="bg-gray-100 p-4 rounded-md mb-4">
          <ul className="list-none text-center">
            {/* Hardcoded directions */}
            <li>Turn Right</li>
            <li>Turn Left</li>
            <li>U-Turn</li>
            <li>Park Here!</li>
          </ul>
        </div>

        {!parked ? (
          <div className="space-y-4">
            <button
              onClick={handleSetParked}
              className="w-full text-white bg-green-600 py-2 px-4 rounded-lg"
            >
              Set as Parked
            </button>
            <button
              onClick={handleReallotment}
              className="w-full text-orange-600 border-2 border-orange-600 py-2 px-4 rounded-lg"
            >
              Request Re-allotment
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p>Your parking link is ready:</p>
            <p className="text-black break-words">{link}</p>
            <button
              onClick={handleCopyLink}
              className="text-white bg-black py-2 px-4 rounded-lg"
            >
              Copy Link
            </button>
            <button
              onClick={handleShowQRCode}
              className="w-full text-blue-600 border-2 border-blue-600 py-2 px-4 rounded-lg mt-4"
            >
              Show QR Code
            </button>
            {showQRCode && (
              <div className="mt-4 flex justify-center">
                <QRCodeCanvas value={link} size={256} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Directions;
