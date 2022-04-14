// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IStreamRegistry {

    event StreamCreated(string id, string metadata);
    event StreamDeleted(string id);
    event StreamUpdated(string id, string metadata);
    event PermissionUpdated(string streamId, address user, bool canEdit, bool canDelete, uint256 publishExpiration, uint256 subscribeExpiration, bool canGrant);

    enum PermissionType { Edit, Delete, Publish, Subscribe, Grant }

    struct Permission {
        bool canEdit;
        bool canDelete;
        uint256 publishExpiration;
        uint256 subscribeExpiration;
        bool canGrant;
    }

    function createStream(string calldata streamIdPath, string calldata metadataJsonString) external;
    function createStreamWithENS(string calldata ensName, string calldata streamIdPath, string calldata metadataJsonString) external;
    function deleteStream(string calldata streamId) external;

    function exists(string calldata streamId) external view returns (bool);

    /**
     * Called by the ENSCache when the lookup / update is complete
     */
    // solhint-disable-next-line func-name-mixedcase
    function ENScreateStreamCallback(address ownerAddress, string memory ensName, string calldata streamIdPath, string calldata metadataJsonString) external;

    function updateStreamMetadata(string calldata streamId, string calldata metadata) external;
    function getStreamMetadata(string calldata streamId) external view returns (string memory des);

    function setPermissionsForUser(
        string calldata streamId,
        address user,
        bool canEdit,
        bool deletePerm,
        uint256 publishExpiration,
        uint256 subscribeExpiration,
        bool canGrant
    ) external;
    function getPermissionsForUser(string calldata streamId, address user) external view;
    function getDirectPermissionsForUser(string calldata streamId, address user) external view returns (Permission memory permission);

    function hasPermission(string calldata streamId, address user, PermissionType permissionType) external view returns (bool userHasPermission);
    function hasPublicPermission(string calldata streamId, PermissionType permissionType) external view returns (bool userHasPermission);
    function hasDirectPermission(string calldata streamId, address user, PermissionType permissionType) external view returns (bool userHasPermission);

    function setPermissions(string calldata streamId, address[] calldata users, Permission[] calldata permissions) external;
    function setPermissionsMultipleStreans(string[] calldata streamIds, address[][] calldata users, Permission[][] calldata permissions) external;

    function grantPermission(string calldata streamId, address user, PermissionType permissionType) external;
    function revokePermission(string calldata streamId, address user, PermissionType permissionType) external;
    function revokeAllPermissionsForUser(string calldata streamId, address user) external;

    function setExpirationTime(string calldata streamId, address user, PermissionType permissionType, uint256 expirationTime) external;

    function grantPublicPermission(string calldata streamId, PermissionType permissionType) external;
    function revokePublicPermission(string calldata streamId, PermissionType permissionType) external;
    function setPublicPermission(string calldata streamId, uint256 publishExpiration, uint256 subscribeExpiration) external;

    function transferAllPermissionsToUser(string calldata streamId, address recipient) external;
    function transferPermissionToUser(string calldata streamId, address recipient, PermissionType permissionType) external;

    function trustedSetStreamMetadata(string calldata streamId, string calldata metadata) external;
    function trustedCreateStreams(string[] calldata streamIds, string[] calldata metadatas) external;
    function trustedSetStreamWithPermission(
        string calldata streamId,
        string calldata metadata,
        address user,
        bool canEdit,
        bool deletePerm,
        uint256 publishExpiration,
        uint256 subscribeExpiration,
        bool canGrant
    ) external;

    function trustedSetPermissionsForUser(
        string calldata streamId,
        address user,
        bool canEdit,
        bool deletePerm,
        uint256 publishExpiration,
        uint256 subscribeExpiration,
        bool canGrant
    ) external;
    function trustedSetStreams(string[] calldata streamids, address[] calldata users, string[] calldata metadatas, Permission[] calldata permissions) external;
    function trustedSetPermissions(string[] calldata streamids, address[] calldata users, Permission[] calldata permissions) external;
}
