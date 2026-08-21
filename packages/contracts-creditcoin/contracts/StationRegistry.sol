// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title StationRegistry
/// @notice Creditcoin registry for ChargeProof station identity, payout, device trust, and metrics.
contract StationRegistry is Ownable2Step {
    struct Station {
        address payout;
        address deviceSigner;
        bool active;
        string metadataURI;
        uint64 completedSessions;
        uint64 successfulSettlements;
        uint256 totalEnergyWh;
        uint256 totalValueSettled;
    }

    mapping(bytes32 stationId => Station stationData) private _stations;
    address public metricsRecorder;

    error EmptyStationId();
    error InvalidStationAccount();
    error MetricsRecorderAlreadySet();
    error NotMetricsRecorder(address caller);
    error StationAlreadyExists(bytes32 stationId);
    error StationNotFound(bytes32 stationId);

    event MetricsRecorderSet(address indexed recorder);
    event StationConfigured(
        bytes32 indexed stationId,
        address indexed payout,
        address indexed deviceSigner,
        bool active,
        string metadataURI
    );
    event StationMetricsRecorded(
        bytes32 indexed stationId,
        bytes32 indexed sessionId,
        uint64 energyWh,
        uint256 value,
        uint64 completedSessions
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerStation(
        bytes32 stationId,
        address payout,
        address deviceSigner,
        string calldata metadataURI
    ) external onlyOwner {
        if (stationId == bytes32(0)) revert EmptyStationId();
        if (payout == address(0) || deviceSigner == address(0)) revert InvalidStationAccount();
        if (_stations[stationId].payout != address(0)) revert StationAlreadyExists(stationId);

        _stations[stationId] = Station({
            payout: payout,
            deviceSigner: deviceSigner,
            active: true,
            metadataURI: metadataURI,
            completedSessions: 0,
            successfulSettlements: 0,
            totalEnergyWh: 0,
            totalValueSettled: 0
        });
        emit StationConfigured(stationId, payout, deviceSigner, true, metadataURI);
    }

    function updateStation(
        bytes32 stationId,
        address payout,
        address deviceSigner,
        bool active,
        string calldata metadataURI
    ) external onlyOwner {
        Station storage stationData = _stations[stationId];
        if (stationData.payout == address(0)) revert StationNotFound(stationId);
        if (payout == address(0) || deviceSigner == address(0)) revert InvalidStationAccount();

        stationData.payout = payout;
        stationData.deviceSigner = deviceSigner;
        stationData.active = active;
        stationData.metadataURI = metadataURI;
        emit StationConfigured(stationId, payout, deviceSigner, active, metadataURI);
    }

    /// @dev Set once after escrow deployment; avoiding later replacement limits owner abuse.
    function setMetricsRecorder(address recorder) external onlyOwner {
        if (metricsRecorder != address(0)) revert MetricsRecorderAlreadySet();
        if (recorder == address(0)) revert InvalidStationAccount();
        metricsRecorder = recorder;
        emit MetricsRecorderSet(recorder);
    }

    function station(bytes32 stationId) external view returns (Station memory) {
        return _stations[stationId];
    }

    function requireActiveStation(
        bytes32 stationId
    ) external view returns (address payout, address deviceSigner) {
        Station storage stationData = _stations[stationId];
        if (stationData.payout == address(0)) revert StationNotFound(stationId);
        if (!stationData.active) revert StationNotFound(stationId);
        return (stationData.payout, stationData.deviceSigner);
    }

    function recordSettlement(
        bytes32 stationId,
        bytes32 sessionId,
        uint64 energyWh,
        uint256 value
    ) external {
        if (msg.sender != metricsRecorder) revert NotMetricsRecorder(msg.sender);
        Station storage stationData = _stations[stationId];
        if (stationData.payout == address(0)) revert StationNotFound(stationId);

        stationData.completedSessions += 1;
        stationData.successfulSettlements += 1;
        stationData.totalEnergyWh += energyWh;
        stationData.totalValueSettled += value;
        emit StationMetricsRecorded(
            stationId,
            sessionId,
            energyWh,
            value,
            stationData.completedSessions
        );
    }
}
