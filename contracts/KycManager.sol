// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IKycManager.sol";

contract KycManager is IKycManager, Ownable {
    event GrantKyc(address _investor, KycType _kycType);
    event RevokeKyc(address _investor, KycType _kycType);
    event Banned(address _investor, bool _status);
    event SetStrict(bool _status);

    mapping(address => User) userList;
    bool strictOn;

    modifier onlyNonZeroAddress(address _investor) {
        require(_investor != address(0), "invalid address");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                          GRANT KYC
    //////////////////////////////////////////////////////////////*/
    function grantKycInBulk(
        address[] calldata _investors,
        KycType[] calldata _kycTypes
    ) external onlyOwner {
        require(_investors.length == _kycTypes.length, "invalid input");
        for (uint256 i = 0; i < _investors.length; i++) {
            _grantKyc(_investors[i], _kycTypes[i]);
        }
    }

    function _grantKyc(
        address _investor,
        KycType _kycType
    ) internal onlyNonZeroAddress(_investor) {
        require(
            KycType.US_KYC == _kycType || KycType.GENERAL_KYC == _kycType,
            "invalid kyc type"
        );

        User storage user = userList[_investor];
        user.kycType = _kycType;
        emit GrantKyc(_investor, _kycType);
    }

    /*//////////////////////////////////////////////////////////////
                          REVOKE KYC
    //////////////////////////////////////////////////////////////*/
    function revokeKycInBulk(address[] calldata _investors) external onlyOwner {
        for (uint256 i = 0; i < _investors.length; i++) {
            _revokeKyc(_investors[i]);
        }
    }

    function _revokeKyc(
        address _investor
    ) internal onlyNonZeroAddress(_investor) {
        User storage user = userList[_investor];
        emit RevokeKyc(_investor, user.kycType);
        user.kycType = KycType.NON_KYC;
    }

    /*//////////////////////////////////////////////////////////////
                          BAN KYC
    //////////////////////////////////////////////////////////////*/
    function bannedInBulk(address[] calldata _investors) external onlyOwner {
        for (uint256 i = 0; i < _investors.length; i++) {
            _bannedInternal(_investors[i], true);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          UNBAN KYC
    //////////////////////////////////////////////////////////////*/
    function unBannedInBulk(address[] calldata _investors) external onlyOwner {
        for (uint256 i = 0; i < _investors.length; i++) {
            _bannedInternal(_investors[i], false);
        }
    }

    function _bannedInternal(
        address _investor,
        bool _status
    ) internal onlyNonZeroAddress(_investor) {
        User storage user = userList[_investor];
        user.isBanned = _status;
        emit Banned(_investor, _status);
    }

    function setStrict(bool _status) external onlyOwner {
        strictOn = _status;
        emit SetStrict(_status);
    }

    /*//////////////////////////////////////////////////////////////
                            USED BY INTERFACE
    //////////////////////////////////////////////////////////////*/
    function getUserInfo(
        address _investor
    ) external view returns (User memory user) {
        user = userList[_investor];
    }

    function onlyNotBanned(address _investor) external view {
        require(!userList[_investor].isBanned, "user is banned");
    }

    function onlyKyc(address _investor) external view {
        require(
            KycType.NON_KYC != userList[_investor].kycType,
            "not a kyc user"
        );
    }

    function isBanned(address _investor) external view returns (bool) {
        return userList[_investor].isBanned;
    }

    function isKyc(address _investor) external view returns (bool) {
        return KycType.NON_KYC != userList[_investor].kycType;
    }

    function isUSKyc(address _investor) external view returns (bool) {
        return KycType.US_KYC == userList[_investor].kycType;
    }

    function isNonUSKyc(address _investor) external view returns (bool) {
        return KycType.GENERAL_KYC == userList[_investor].kycType;
    }

    function isStrict() external view returns (bool) {
        return strictOn;
    }
}
